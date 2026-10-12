import { lazy, Suspense, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircleDot,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Search,
  CalendarClock,
} from "lucide-react";
import { useApp } from "./context";
import { api, cachedAPI } from "./offline";
import { money, number, today } from "./utils";
import type { RecordBase, Mutation } from "./types";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { Empty, EventRow, PageHeading } from "./Views";

const BankImport = lazy(() => import("./BankImport"));

type Entity = "tire_set" | "budget" | "recurring_cost";
type Interval = {
  mounted_at: string;
  mounted_km: string | number;
  removed_at: string;
  removed_km: string | number | null;
};
type Report = {
  budgets: any[];
  forecast: any[];
  parts: any[];
  maintenance_due?: any[];
};
type ImportRow = {
  line: number;
  id?: string;
  source: Record<string, string>;
  data?: Record<string, any>;
  duplicate?: boolean;
  error?: string;
};
const seasons: Record<string, string> = {
  summer: "Летние",
  winter: "Зимние",
  all: "Всесезонные",
};

function ToolForm({
  entity,
  record,
  onClose,
}: {
  entity: Entity;
  record?: RecordBase;
  onClose: () => void;
}) {
  const { selected, state, save, notify } = useApp();
  const [intervals, setIntervals] = useState<Interval[]>(
    record?.intervals || [],
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const car = state.vehicles.find((v) => v.id === selected);
  const title =
    entity === "tire_set"
      ? "Комплект шин"
      : entity === "budget"
        ? "Месячный бюджет"
        : "Регулярный платёж";
  function close() {
    if (!dirty || confirm("Закрыть форму и потерять несохранённые изменения?"))
      onClose();
  }
  function changeInterval(index: number, key: keyof Interval, value: string) {
    setDirty(true);
    setIntervals((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }
  return (
    <Sheet open onClose={close} title={title}>
      <form
        className="record-form"
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const data: Record<string, any> = {
              ...Object.fromEntries(new FormData(e.currentTarget)),
              vehicle_id: record?.vehicle_id || selected,
            };
            if (entity === "tire_set") data.intervals = intervals;
            if (entity === "recurring_cost")
              data.enabled = (
                e.currentTarget.elements.namedItem(
                  "enabled",
                ) as HTMLInputElement
              ).checked;
            await save(entity, data, record);
            notify("Сохранено");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="field-help">
          {car?.name} ·{" "}
          {entity === "tire_set"
            ? "История использования не создаёт расход. Покупку запишите отдельно."
            : "План не добавляет фактических расходов."}
        </p>
        {entity === "tire_set" ? (
          <>
            <div className="field-grid">
              <label>
                Марка шин
                <input
                  name="brand"
                  defaultValue={record?.brand}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Модель шин
                <input
                  name="model"
                  defaultValue={record?.model}
                  maxLength={100}
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                Размер
                <input
                  name="size"
                  placeholder="235/55 R19"
                  defaultValue={record?.size}
                />
              </label>
              <label>
                Сезон
                <select name="season" defaultValue={record?.season || "winter"}>
                  {Object.entries(seasons).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Заметка
              <textarea name="notes" defaultValue={record?.notes} />
            </label>
            <div className="section-heading">
              <h3>Подтверждённая история</h3>
            </div>
            {intervals.map((row, index) => (
              <section className="tire-interval" key={index}>
                <div className="section-heading">
                  <strong>Интервал {index + 1}</strong>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Удалить интервал ${index + 1}`}
                    onClick={() => {
                      setDirty(true);
                      setIntervals((rows) =>
                        rows.filter((_, i) => i !== index),
                      );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="field-grid">
                  <label>
                    Установлены
                    <input
                      type="date"
                      required
                      value={row.mounted_at}
                      onChange={(e) =>
                        changeInterval(index, "mounted_at", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Пробег установки
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={row.mounted_km}
                      onChange={(e) =>
                        changeInterval(index, "mounted_km", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label>
                    Сняты
                    <input
                      type="date"
                      value={row.removed_at}
                      onChange={(e) =>
                        changeInterval(index, "removed_at", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Пробег снятия
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.removed_km ?? ""}
                      onChange={(e) =>
                        changeInterval(index, "removed_km", e.target.value)
                      }
                    />
                  </label>
                </div>
              </section>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={intervals.some((i) => !i.removed_at)}
              onClick={() => {
                setDirty(true);
                setIntervals((rows) => [
                  ...rows,
                  {
                    mounted_at: today(),
                    mounted_km: car?.current_odometer || 0,
                    removed_at: "",
                    removed_km: null,
                  },
                ]);
              }}
            >
              <Plus size={16} />
              Добавить установку
            </Button>
            {intervals.some((i) => !i.removed_at) && (
              <p className="field-help">
                Закройте текущий интервал перед следующей установкой. Пробег шин
                не является оценкой их технического состояния.
              </p>
            )}
          </>
        ) : (
          <>
            {entity === "budget" ? (
              <label>
                Месяц
                <input
                  type="month"
                  name="month"
                  required
                  defaultValue={record?.month || today().slice(0, 7)}
                />
              </label>
            ) : (
              <label>
                Название платежа
                <input
                  name="title"
                  required
                  defaultValue={record?.title}
                  placeholder="Страховка, парковка, налог"
                />
              </label>
            )}
            <div className="field-grid">
              <label>
                Сумма
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={record ? String(record.amount_minor / 100) : ""}
                />
              </label>
              <label>
                Валюта
                <input
                  name="currency"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                  defaultValue={record?.currency || "RUB"}
                />
              </label>
            </div>
            <label>
              Категория (пусто — все расходы)
              <input name="category" defaultValue={record?.category} />
            </label>
            {entity === "recurring_cost" && (
              <>
                <div className="field-grid">
                  <label>
                    Ближайшая дата
                    <input
                      type="date"
                      name="next_date"
                      required
                      defaultValue={record?.next_date || today()}
                    />
                  </label>
                  <label>
                    Каждые, месяцев
                    <input
                      type="number"
                      min="1"
                      max="120"
                      step="1"
                      name="interval_months"
                      required
                      defaultValue={record?.interval_months || 1}
                    />
                  </label>
                </div>
                <label className="check-field">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={record?.enabled ?? true}
                  />
                  Включить в прогноз
                </label>
              </>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button type="button" variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function CSVImport() {
  const { selected, session, refresh, notify } = useApp();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = rows.filter(
    (row) => !row.error && !row.duplicate && row.id,
  );
  const selectedRows = available.filter((row) => checked.has(row.id!));
  const needsOdometer = selectedRows.some(
    (row) => row.data?.odometer !== null && row.data?.odometer !== undefined,
  );
  return (
    <>
      <PageHeading
        eyebrow="ВАША ИСТОРИЯ БЕЗ РУЧНОГО ВВОДА"
        title="Импорт из CSV"
        description="Сначала проверьте строки. В гараж попадут только подтверждённые записи."
      />
      <section className="panel ownership-import">
        <h3>Документированный формат</h3>
        <p className="muted">
          UTF-8, разделитель запятая или точка с запятой. Обязательны
          occurred_at и kind. Для расходов нужна amount; для топлива — любые два
          из amount, liters, price. Максимум 1 000 строк и 2 МБ.
        </p>
        <code className="csv-example">
          external_id,occurred_at,kind,amount,description
          <br />
          my-001,2026-01-15,expense,1500,Мойка
        </code>
        <p className="field-help">
          Типы: expense, fuel, maintenance, odometer, note. Дополнительно:
          category, odometer, currency, full, gap, fuel, station, vendor, tags.
          external_id помогает обнаружить повторный импорт; изменённая строка с
          тем же ID будет отклонена.
        </p>
        <label className="file-picker">
          <Upload size={22} />
          <span>Выбрать CSV для проверки</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy || !selected}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              setRows([]);
              setConfirmed(false);
              try {
                if (file.size > 2 * 1024 * 1024)
                  throw new Error("CSV превышает 2 МБ");
                const body = new FormData();
                body.append("file", file);
                body.append("vehicle_id", selected);
                const result = await api<{ rows: ImportRow[] }>(
                  "/import/csv/preview",
                  { method: "POST", body },
                  session.csrf,
                );
                setRows(result.rows);
                setChecked(
                  new Set(
                    result.rows
                      .filter((row) => !row.error && !row.duplicate && row.id)
                      .map((row) => row.id!),
                  ),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        {!navigator.onLine && (
          <p className="field-help">Импорт требует подключения к серверу.</p>
        )}
        {busy && <p role="status">Обрабатываем файл…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {rows.length > 0 && (
        <section className="panel ownership-import">
          <div className="section-heading">
            <h3>Проверка строк</h3>
            <span className="muted">
              {selectedRows.length} выбрано ·{" "}
              {rows.filter((row) => row.error).length} ошибок ·{" "}
              {rows.filter((row) => row.duplicate).length} повторов
            </span>
          </div>
          <div className="csv-rows">
            {rows.map((row, index) => (
              <label
                className={`csv-row ${row.error ? "invalid" : ""}`}
                key={index}
              >
                <input
                  type="checkbox"
                  disabled={!!row.error || !!row.duplicate || busy}
                  checked={
                    !!row.id &&
                    checked.has(row.id) &&
                    !row.duplicate &&
                    !row.error
                  }
                  onChange={(e) =>
                    setChecked((prior) => {
                      const next = new Set(prior);
                      if (e.target.checked) next.add(row.id!);
                      else next.delete(row.id!);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>
                    Строка {row.line} ·{" "}
                    {row.source.description || row.source.kind}
                  </strong>
                  <small>
                    {row.error ||
                      (row.duplicate
                        ? "Уже импортирована / повтор в файле"
                        : `${row.data?.occurred_at?.slice(0, 10)} · ${money(row.data?.amount_minor, row.data?.currency)}`)}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {needsOdometer && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Я проверил исторические показания пробега выбранных строк
            </label>
          )}
          <Button
            disabled={
              busy || !selectedRows.length || (needsOdometer && !confirmed)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(
                  "/import/csv/commit",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      vehicle_id: selected,
                      rows: selectedRows.map((row) => row.source),
                      confirm_odometer: confirmed,
                    }),
                  },
                  session.csrf,
                );
                await refresh();
                setRows((prior) =>
                  prior.map((row) =>
                    row.id && checked.has(row.id)
                      ? { ...row, duplicate: true }
                      : row,
                  ),
                );
                setChecked(new Set());
                notify(
                  "История импортирована. Повторные операции защищены от дублирования.",
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Подтвердить импорт · {selectedRows.length}
          </Button>
        </section>
      )}
    </>
  );
}

export default function OwnershipTools({ children }: { children: ReactNode }) {
  const {
    state,
    selected,
    setSelected,
    session,
    save,
    notify,
    setPage,
    queue,
  } = useApp();
  const [tab, setTab] = useState("work");
  const visibleTab =
    state.vehicles.find((v) => v.id === selected)?.can_edit === false &&
    ["budget", "import"].includes(tab)
      ? "work"
      : tab;
  const [month, setMonth] = useState(today().slice(0, 7));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ entity: Entity; record?: RecordBase }>();
  const report = useQuery({
    queryKey: [
      "ownership",
      session.id,
      selected,
      month,
      state.events,
      state.budgets,
      state.recurring_costs,
      state.reminders,
    ],
    queryFn: () =>
      cachedAPI<Report>(
        session,
        `/ownership?vehicle_id=${selected}&month=${month}`,
      ),
    enabled:
      !!selected &&
      state.vehicles.find((v) => v.id === selected)?.can_edit !== false &&
      visibleTab !== "work" &&
      visibleTab !== "import",
  });
  const tires = (state.tire_sets || []).filter(
    (row) => row.vehicle_id === selected && !row.deleted,
  );
  const parts = state.events
    .filter(
      (event) =>
        !event.deleted &&
        event.vehicle_id === selected &&
        event.kind === "maintenance",
    )
    .flatMap((event) =>
      event.items.map((item, index) => ({
        ...item,
        event_id: event.id,
        index,
        occurred_at: event.occurred_at,
        currency: event.currency,
      })),
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const budgets = (state.budgets || [])
    .filter(
      (row) =>
        !row.deleted && row.vehicle_id === selected && row.month === month,
    )
    .map((row) => {
      const actual = state.events
        .filter(
          (event) =>
            !event.deleted &&
            event.vehicle_id === selected &&
            event.occurred_at.startsWith(month) &&
            event.currency === row.currency &&
            (!row.category || event.category === row.category),
        )
        .reduce((sum, event) => sum + BigInt(event.amount_minor), 0n);
      return {
        ...row,
        actual_minor: Number(actual),
        remaining_minor: Number(BigInt(row.amount_minor) - actual),
      };
    });
  async function remove(entity: Mutation["entity"], row: RecordBase) {
    if (!confirm("Удалить запись? Действие можно отменить.")) return;
    try {
      const removed = await save(entity, {}, row, "delete");
      notify("Запись удалена", () => {
        void save(entity, {}, removed, "restore").catch((err) =>
          notify((err as Error).message),
        );
      });
    } catch (err) {
      notify((err as Error).message);
    }
  }
  return (
    <>
      <div className="ownership-navigation">
        <div
          className="tabs ownership-tabs"
          role="tablist"
          aria-label="Инструменты обслуживания"
        >
          {[
            ["work", "Работы"],
            ["tires", "Шины"],
            ["parts", "Запчасти"],
            ["budget", "Бюджет"],
            ["import", "Импорт"],
          ]
            .filter(
              ([key]) =>
                state.vehicles.find((v) => v.id === selected)?.can_edit !==
                  false || !["budget", "import"].includes(key),
            )
            .map(([key, label]) => (
              <button
                role="tab"
                aria-selected={visibleTab === key}
                className={visibleTab === key ? "active" : ""}
                key={key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
        </div>
        {visibleTab !== "work" && (
          <label className="filter-select">
            Автомобиль
            <select
              aria-label="Автомобиль инструментов"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setModal(undefined);
              }}
            >
              {state.vehicles.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {visibleTab === "work" ? (
        children
      ) : !selected ? (
        <Empty
          title="Сначала добавьте автомобиль"
          description="Инструменты владения привязаны к вашему автомобилю."
        />
      ) : visibleTab === "import" ? (
        <>
          <Suspense
            fallback={
              <p role="status" className="muted">
                Загружаем проверку выписок…
              </p>
            }
          >
            <BankImport key={`bank-${selected}`} />
          </Suspense>
          <CSVImport key={selected} />
        </>
      ) : visibleTab === "tires" ? (
        <>
          <PageHeading
            eyebrow="СЕЗОНЫ МЕНЯЮТСЯ. ИСТОРИЯ ОСТАЁТСЯ."
            title="Комплекты шин"
            description="Размеры, установки и подтверждённый пробег — в одном месте."
            action={
              <Button
                hidden={
                  state.vehicles.find((v) => v.id === selected)?.can_edit ===
                  false
                }
                onClick={() => setModal({ entity: "tire_set" })}
              >
                <Plus size={16} />
                Добавить комплект
              </Button>
            }
          />
          {!tires.length ? (
            <Empty
              icon={CircleDot}
              title="У каждого сезона свой комплект"
              description="Добавьте марку, размер и историю использования. Мы не будем выдавать пробег за техническое состояние."
              onClick={
                state.vehicles.find((v) => v.id === selected)?.can_edit ===
                false
                  ? undefined
                  : () => setModal({ entity: "tire_set" })
              }
              label="Добавить комплект"
            />
          ) : (
            <div className="ownership-grid">
              {tires.map((tire) => (
                <article className="panel tire-card" key={tire.id}>
                  <div className="section-heading">
                    <span className="eyebrow">{seasons[tire.season]}</span>
                    <CircleDot size={30} />
                  </div>
                  <h2>
                    {tire.brand} {tire.model}
                  </h2>
                  <p className="muted">{tire.size || "Размер не указан"}</p>
                  <div className="tire-distance">
                    <strong>
                      {number(tire.confirmed_km || 0)}
                      <small> км</small>
                    </strong>
                    <span>
                      {tire.pending
                        ? "Предварительно · ожидает проверки сервером"
                        : "подтверждено в закрытых интервалах"}
                    </span>
                  </div>
                  <div className="tire-history">
                    {(tire.intervals || []).map(
                      (interval: Interval, i: number) => (
                        <div key={i}>
                          <span>
                            {interval.mounted_at} →{" "}
                            {interval.removed_at || "установлены"}
                          </span>
                          <strong>
                            {number(Number(interval.mounted_km))} →{" "}
                            {interval.removed_km !== null
                              ? number(Number(interval.removed_km))
                              : "…"}{" "}
                            км
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                  {tire.notes && <p className="muted">{tire.notes}</p>}
                  <div
                    className="ownership-actions"
                    hidden={tire.can_edit === false}
                  >
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal({ entity: "tire_set", record: tire })
                      }
                    >
                      <Pencil size={15} />
                      История и параметры
                    </Button>
                    <button
                      className="icon-button"
                      aria-label={`Удалить ${tire.brand}`}
                      onClick={() => remove("tire_set", tire)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : visibleTab === "parts" ? (
        <>
          <PageHeading
            eyebrow="ПОМНИТЬ КАЖДУЮ ДЕТАЛЬ"
            title="Установленные запчасти"
            description="Каталог из реальных записей ТО. Измените работу — каталог обновится."
          />
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Поиск запчастей"
              placeholder="Название или артикул"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {!parts.length ? (
            <Empty
              title="Детали появятся из истории ТО"
              description="Добавьте позиции и артикулы в запись обслуживания. Их стоимость уже включена в ТО и не учитывается повторно."
            />
          ) : (
            <div className="ownership-grid">
              {parts
                .filter((part) =>
                  `${part.name} ${part.part_number}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((part) => (
                  <article
                    className="panel part-card"
                    key={part.event_id + ":" + part.index}
                  >
                    <span className="eyebrow">
                      {part.part_number || "АРТИКУЛ НЕ УКАЗАН"}
                    </span>
                    <h3>{part.name}</h3>
                    <p className="muted">
                      {part.quantity} шт. ·{" "}
                      {part.amount_minor === undefined
                        ? "Итог после синхронизации"
                        : money(part.amount_minor, part.currency)}
                    </p>
                    {state.events.find((e) => e.id === part.event_id) && (
                      <EventRow
                        entry={state.events.find(
                          (e) => e.id === part.event_id,
                        )!}
                      />
                    )}
                  </article>
                ))}
            </div>
          )}
        </>
      ) : (
        <>
          <PageHeading
            eyebrow="ПЛАНИРУЙТЕ СПОКОЙНО"
            title="Бюджет и будущие расходы"
            description="Факт из истории, план — из известных платежей. Эти суммы не смешиваются."
            action={
              <Button onClick={() => setModal({ entity: "budget" })}>
                <Plus size={16} />
                Задать бюджет
              </Button>
            }
          />
          <label className="ownership-month">
            Месяц
            <input
              aria-label="Месяц бюджета"
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <>
            {report.isLoading && <p role="status">Обновляем прогноз…</p>}
            {report.error && (
              <p role="alert">{(report.error as Error).message}</p>
            )}
            {(!navigator.onLine || queue.length > 0) && (
              <p className="field-help">
                Бюджет рассчитан из локальной истории. Прогноз показан по
                последнему сохранённому отчёту и обновится после синхронизации.
              </p>
            )}
            <div className="ownership-grid">
              {budgets.map((budget) => (
                <article className="panel budget-card" key={budget.id}>
                  <span className="eyebrow">
                    {budget.category || "ВСЕ РАСХОДЫ"} · {budget.currency}
                  </span>
                  <h2>{money(budget.actual_minor, budget.currency)}</h2>
                  <p className="muted">
                    из {money(budget.amount_minor, budget.currency)} на{" "}
                    {budget.month}
                  </p>
                  <div
                    className="budget-progress"
                    role="meter"
                    aria-label="Доля использованного бюджета"
                    aria-valuenow={Math.max(0, budget.actual_minor)}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(
                      budget.amount_minor,
                      budget.actual_minor,
                      1,
                    )}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, budget.amount_minor ? (budget.actual_minor / budget.amount_minor) * 100 : 100)}%`,
                      }}
                    />
                  </div>
                  <p
                    className={
                      budget.remaining_minor < 0 ? "warning-text" : "muted"
                    }
                  >
                    {budget.remaining_minor < 0 ? "Превышение" : "Осталось"}:{" "}
                    {money(Math.abs(budget.remaining_minor), budget.currency)}
                  </p>
                  <div className="ownership-actions">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal({ entity: "budget", record: budget })
                      }
                    >
                      Изменить
                    </Button>
                    <button
                      className="icon-button"
                      aria-label="Удалить бюджет"
                      onClick={() => remove("budget", budget)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!budgets.length && (
              <Empty
                title="Расходам можно задать ориентир"
                description="Создайте бюджет на месяц для всего автомобиля или конкретной категории."
                onClick={() => setModal({ entity: "budget" })}
                label="Задать бюджет"
              />
            )}
            <div className="section-heading">
              <h3>Регулярные платежи</h3>
              <Button
                variant="outline"
                onClick={() => setModal({ entity: "recurring_cost" })}
              >
                <Plus size={16} />
                Добавить платёж
              </Button>
            </div>
            <div className="ownership-grid">
              {(state.recurring_costs || [])
                .filter((row) => row.vehicle_id === selected && !row.deleted)
                .map((row) => (
                  <article className="panel recurring-card" key={row.id}>
                    <CalendarClock size={24} />
                    <h3>{row.title}</h3>
                    <strong>{money(row.amount_minor, row.currency)}</strong>
                    <p className="muted">
                      {row.next_date} · каждые {row.interval_months} мес. ·{" "}
                      {row.enabled ? "в прогнозе" : "отключён"}
                    </p>
                    <div className="ownership-actions">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setModal({ entity: "recurring_cost", record: row })
                        }
                      >
                        Изменить
                      </Button>
                      <button
                        className="icon-button"
                        aria-label={`Удалить платёж ${row.title}`}
                        onClick={() => remove("recurring_cost", row)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            <section className="panel forecast-panel">
              <span className="eyebrow">ПЛАН · НЕ ФАКТИЧЕСКИЕ РАСХОДЫ</span>
              <h3>Следующие 12 месяцев от {month}</h3>
              <p className="muted">
                Известные регулярные платежи и ближайшие ТО с заданной оценкой.
                Дата ТО — календарный предел: по пробегу оно может потребоваться
                раньше. Повторы появятся после подтверждения выполнения. Не
                добавляйте одну работу одновременно как платёж и ТО.
              </p>
              {!report.data?.forecast.length ? (
                <p className="muted">
                  Добавьте регулярный платёж или стоимость ТО с датой в этом
                  периоде.
                </p>
              ) : (
                report.data.forecast.map((row, i) => (
                  <div className="forecast-row" key={i}>
                    <span>{row.date}</span>
                    <strong>
                      {row.title}
                      {row.source === "maintenance" && (
                        <small className="muted">
                          Оценка ТО
                          {row.mileage_deadline
                            ? " · или раньше по пробегу"
                            : ""}
                        </small>
                      )}
                    </strong>
                    <span>{money(row.amount_minor, row.currency)}</span>
                  </div>
                ))
              )}
            </section>
            <section className="panel forecast-panel">
              <h3>Обслуживание по известным интервалам</h3>
              <p className="muted">
                Километровый предел не преобразуется в выдуманную дату. Работа
                без цены остаётся неизвестной суммой; без даты — вне
                календарного плана. Просроченные работы не переносятся
                автоматически на начало периода.
              </p>
              {report.data?.maintenance_due?.map((row) => (
                <button
                  className="forecast-row text-link"
                  key={row.id}
                  onClick={() => setPage("reminders")}
                >
                  <span>{row.due_date || "По пробегу"}</span>
                  <strong>
                    {row.title}
                    <small className="muted">
                      {row.estimated_cost_minor == null
                        ? "Стоимость не задана"
                        : `Оценка: ${money(row.estimated_cost_minor, row.cost_currency || "RUB")}`}
                    </small>
                  </strong>
                  <span>
                    {row.due_odometer !== null && row.due_odometer !== undefined
                      ? number(row.due_odometer) + " км"
                      : ""}
                  </span>
                </button>
              ))}
            </section>
          </>
        </>
      )}
      {modal && (
        <ToolForm
          entity={modal.entity}
          record={modal.record}
          onClose={() => setModal(undefined)}
        />
      )}
    </>
  );
}
