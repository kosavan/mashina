import type { Cached, Mutation, Session, State } from "./types";
import { currentKm } from "./utils";
import { pendingMoney } from "./calculations";

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  csrf = "",
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body)
    headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch("/api/v1" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: "Ошибка сервера" }));
    throw new APIError(
      response.status,
      typeof body.detail === "string"
        ? body.detail
        : "Проверьте заполнение полей",
    );
  }
  return response.json();
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("mashina-private-v1", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("cache");
      req.result.createObjectStore("outbox", { keyPath: "operation_id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
async function read<T>(
  store: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function cached(): Promise<Cached | undefined> {
  return read("cache", "current");
}
export async function queueFor(owner: string): Promise<Mutation[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction("outbox").objectStore("outbox").getAll();
    req.onsuccess = () =>
      resolve(
        req.result
          .filter((r: { owner: string }) => r.owner === owner)
          .sort(
            (a: { queued_at?: number }, b: { queued_at?: number }) =>
              (a.queued_at || 0) - (b.queued_at || 0),
          )
          .map((r: Mutation & { owner?: string; queued_at?: number }) => {
            const copy = { ...r };
            delete copy.owner;
            delete copy.queued_at;
            return copy;
          }),
      );
    req.onerror = () => reject(req.error);
  });
}
async function commit(
  session: Session,
  state: State,
  operation?: Mutation,
  remove?: string,
) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["cache", "outbox"], "readwrite");
    tx.objectStore("cache").put({ session, state }, "current");
    tx.objectStore("cache").put({ session, state }, session.id);
    if (operation) {
      const outbox = tx.objectStore("outbox");
      const prior = outbox.get(operation.operation_id);
      prior.onsuccess = () =>
        outbox.put({
          ...operation,
          owner: session.id,
          queued_at:
            prior.result?.queued_at ??
            Date.now() * 1000 + Math.floor(performance.now() % 1000),
        });
    }
    if (remove) tx.objectStore("outbox").delete(remove);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error(
          "Не удалось сохранить на устройстве. Проверьте свободное место.",
        ),
      );
    tx.onabort = () => reject(new Error("Локальное сохранение прервано"));
  });
}
export async function clearLocal() {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["cache", "outbox"], "readwrite");
    tx.objectStore("cache").clear();
    tx.objectStore("outbox").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function project(state: State, operation: Mutation): State {
  const result = structuredClone(state);
  const table = (
    {
      vehicle: "vehicles",
      event: "events",
      category: "categories",
      reminder: "reminders",
      tire_set: "tire_sets",
      budget: "budgets",
      recurring_cost: "recurring_costs",
    } as const
  )[operation.entity as "vehicle"];
  if (operation.entity === "settings") {
    result.settings = { ...result.settings, ...operation.data };
    return result;
  }
  const rows = (result[table] ||= []) as any[];
  const index = rows.findIndex((r) => r.id === operation.id);
  const prior = index >= 0 ? rows[index] : {};
  const record = {
    ...prior,
    ...operation.data,
    id: operation.id,
    version: (prior.version || 0) + 1,
    pending: true,
  };
  if (operation.action === "delete") record.deleted = true;
  if (operation.action === "restore") record.deleted = false;
  if (operation.entity === "event") {
    record.currency ||= "RUB";
    try {
      record.amount_minor = pendingMoney(record);
    } catch {
      record.amount_minor = prior.amount_minor || 0;
    }
    record.items ||= [];
    record.description ||= "";
  }
  if (operation.entity === "tire_set") {
    record.confirmed_km = (record.intervals || []).reduce(
      (sum: number, row: any) =>
        sum +
        (row.removed_at && row.removed_km !== null
          ? Math.max(0, Number(row.removed_km) - Number(row.mounted_km))
          : 0),
      0,
    );
  }
  if (operation.entity === "budget" || operation.entity === "recurring_cost") {
    record.amount_minor = pendingMoney({ ...record, kind: "expense" });
  }
  if (operation.entity === "vehicle") {
    record.purchase_odometer = Number(record.purchase_odometer || 0);
    record.currency ||= "RUB";
    record.status ||= "active";
  }
  if (index >= 0) rows[index] = record;
  else rows.push(record);
  for (const v of result.vehicles)
    v.current_odometer = currentKm(v, result.events);
  return result;
}
export async function loadState(session: Session) {
  const prior = await read<Cached>("cache", session.id);
  try {
    let state = await api<State>("/state");
    for (const operation of await queueFor(session.id))
      state = project(state, operation);
    await commit(session, state);
    return state;
  } catch (error) {
    if (error instanceof APIError || !prior) throw error;
    return prior.state;
  }
}
export async function enqueue(
  session: Session,
  state: State,
  operation: Mutation,
) {
  const next = project(state, operation);
  await commit(session, next, operation);
  navigator.storage?.persist?.().catch(() => {});
  return next;
}
let syncing = false;
export async function synchronize(
  session: Session,
  onChange: (state: State, queue: Mutation[]) => void,
) {
  if (syncing) return;
  syncing = true;
  try {
    const run = async () => {
      const blocked = new Set<string>();
      for (const operation of await queueFor(session.id)) {
        const key = operation.entity + operation.id;
        if (operation.error || blocked.has(key)) {
          blocked.add(key);
          continue;
        }
        try {
          await api(
            "/mutate",
            { method: "POST", body: JSON.stringify(operation) },
            session.csrf,
          );
          let state = await api<State>("/state");
          const remaining = (await queueFor(session.id)).filter(
            (o) => o.operation_id !== operation.operation_id,
          );
          for (const o of remaining) state = project(state, o);
          await commit(session, state, undefined, operation.operation_id);
          onChange(state, remaining);
        } catch (error) {
          if (error instanceof APIError) {
            blocked.add(key);
            const prior = await read<Cached>("cache", session.id);
            if (prior) {
              const failed = {
                ...operation,
                error: error.message,
                status: error.status,
              };
              await commit(session, prior.state, failed);
              onChange(prior.state, await queueFor(session.id));
            }
            if (error.status === 401) break;
          } else break;
        }
      }
    };
    if (navigator.locks) await navigator.locks.request("mashina-sync", run);
    else await run();
  } finally {
    syncing = false;
  }
}
export async function resolveOperation(
  session: Session,
  operation: Mutation,
  retry: boolean,
) {
  let state = await api<State>("/state");
  if (retry) {
    const table = (
      {
        vehicle: "vehicles",
        event: "events",
        category: "categories",
        reminder: "reminders",
        tire_set: "tire_sets",
        budget: "budgets",
        recurring_cost: "recurring_costs",
      } as const
    )[operation.entity as "vehicle"];
    const row = (state[table] as any[]).find((r) => r.id === operation.id);
    const next = {
      ...operation,
      operation_id: crypto.randomUUID(),
      expected_version: row?.version,
    };
    delete next.error;
    delete next.status;
    state = project(state, next);
    await commit(session, state, next, operation.operation_id);
  } else await commit(session, state, undefined, operation.operation_id);
  return state;
}

export async function cachedAPI<T>(session: Session, path: string): Promise<T> {
  const key = `response:${session.id}:${path}`;
  try {
    const result = await api<T>(path);
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("cache", "readwrite");
      tx.objectStore("cache").put(result, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return result;
  } catch (error) {
    if (error instanceof APIError) throw error;
    const prior = await read<T>("cache", key);
    if (prior === undefined)
      throw new Error(
        "Нет сохранённого отчёта для этих фильтров. Подключитесь к серверу и откройте раздел ещё раз.",
      );
    return prior;
  }
}
