import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  CarFront,
  LayoutGrid,
  Clock3,
  Fuel,
  Wrench,
  ChartNoAxesCombined,
  Files,
  Bell,
  Settings,
  Plus,
  Check,
  CloudOff,
  RefreshCw,
  ShieldCheck,
  Menu,
  X,
  Sun,
  Moon,
  LockKeyhole,
} from "lucide-react";
import type {
  Kind,
  Page,
  RecordBase,
  Session,
  Mutation,
  Attachment,
} from "./types";
import {
  api,
  APIError,
  cached,
  loadState,
  enqueue,
  queueFor,
  synchronize,
  clearLocal,
  resolveOperation,
} from "./offline";
import { AppContext } from "./context";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import {
  Garage,
  VehiclePage,
  Timeline,
  FuelPage,
  Maintenance,
  Documents,
  Reminders,
  SettingsPage,
} from "./Views";
import { RecordForm } from "./Forms";
const Analytics = lazy(() => import("./Analytics"));
const navigation = [
  ["garage", "Мой гараж", LayoutGrid],
  ["timeline", "История", Clock3],
  ["fuel", "Заправки", Fuel],
  ["maintenance", "Обслуживание", Wrench],
  ["analytics", "Аналитика", ChartNoAxesCombined],
  ["documents", "Документы", Files],
  ["reminders", "Напоминания", Bell],
] as const;

function Auth({ onSession }: { onSession: (session: Session) => void }) {
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ required: boolean }>("/setup")
      .then((r) => setSetup(r.required))
      .catch(() => setError("Сервер недоступен. Проверьте соединение."));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      onSession(
        await api<Session>(setup ? "/setup" : "/login", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      onSession(await api<Session>("/demo", { method: "POST" }));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a href="#" className="wordmark">
          <span className="brand-mark">
            <CarFront size={21} />
          </span>
          MASHINA<span className="brand-dot">®</span>
        </a>
        <div className="auth-copy">
          <span className="eyebrow">ДЛЯ ТЕХ, КТО ЛЮБИТ СВОЮ МАШИНУ</span>
          <h1>
            Больше, чем
            <br />
            просто <em>гараж.</em>
          </h1>
          <p>
            Каждая поездка. Каждая деталь.
            <br />
            Вся история ваших автомобилей — в одном месте.
          </p>
          <div className="auth-car">
            <img src="/volvo-demo.webp" alt="Иллюстрация автомобиля" />
          </div>
          <div className="auth-bottom">
            <ShieldCheck size={17} /> Ваш сервер. Ваши данные. Ваши правила.
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div>
          <span className="label-pill">ПЕРСОНАЛЬНЫЙ ЦИФРОВОЙ ГАРАЖ</span>
          <h2>{setup ? "Добро пожаловать." : "С возвращением."}</h2>
          <p className="muted">
            {setup
              ? "Создайте свой гараж. Всё остальное уже продумано."
              : "Ваши автомобили и их истории ждут вас."}
          </p>
          <form onSubmit={submit} className="form-stack">
            <label>
              Имя пользователя
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={64}
                required
                placeholder="Как к вам обращаться"
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                autoComplete={setup ? "new-password" : "current-password"}
                minLength={12}
                maxLength={256}
                required
                placeholder="Не менее 12 символов"
              />
            </label>
            {setup && (
              <label>
                Одноразовый код установки
                <input
                  name="bootstrap_token"
                  type="password"
                  autoComplete="off"
                  required
                />
                <small>
                  Код из файла .bootstrap-token на вашем сервере.
                  <br />
                  Создайте его командой из инструкции установки.
                </small>
              </label>
            )}
            {error && (
              <div role="alert" className="error-box">
                {error}
              </div>
            )}
            <Button disabled={busy} type="submit">
              {busy
                ? "Подождите…"
                : setup
                  ? "Создать мой гараж"
                  : "Войти в гараж"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="divider-label">СНАЧАЛА ПОЗНАКОМИМСЯ?</div>
          <Button
            variant="outline"
            className="full"
            disabled={busy}
            onClick={demo}
          >
            Посмотреть демогараж
            <ArrowUpRight size={18} />
          </Button>
          <p className="tiny muted centered">
            Вымышленные автомобили. Настоящие возможности.
            <br />
            Демо полностью изолировано от ваших данных.
          </p>
          <div className="auth-private">
            <LockKeyhole size={14} /> Без облаков и скрытой телеметрии
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [boot, setBoot] = useState(true);
  const [page, setPage] = useState<Page>("garage");
  const [selected, setSelected] = useState("");
  const [queue, setQueue] = useState<Mutation[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("mashina-theme") || "dark",
  );
  const [modal, setModal] = useState<{
    type: Kind | "vehicle" | "reminder" | "document" | "category" | "quick";
    record?: RecordBase;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    action?: () => void;
  } | null>(null);
  const notify = useCallback(
    (message: string, action?: () => void) => setToast({ message, action }),
    [],
  );
  useEffect(() => {
    let active = true;
    api<Session>("/session")
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(async (error) => {
        if (!(error instanceof APIError)) {
          const cache = await cached();
          if (active && cache) setSession(cache.session);
        }
      })
      .finally(() => {
        if (active) setBoot(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mashina-theme", theme);
    document
      .querySelector("meta[name=theme-color]")
      ?.setAttribute("content", theme === "dark" ? "#101211" : "#f5f6f2");
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 15000 : 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const query = useQuery({
    queryKey: ["state", session?.id],
    queryFn: () => loadState(session!),
    enabled: !!session,
  });
  const state = query.data;
  const refresh = useCallback(async () => {
    if (session) {
      client.setQueryData(["state", session.id], await loadState(session));
      setQueue(await queueFor(session.id));
    }
  }, [session, client]);
  const sync = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      await synchronize(session, (data, pending) => {
        client.setQueryData(["state", session.id], data);
        setQueue(pending);
      });
      setQueue(await queueFor(session.id));
    } finally {
      setSyncing(false);
    }
  }, [session, client]);
  useEffect(() => {
    if (session) {
      queueFor(session.id).then(setQueue);
      sync();
    }
  }, [session, sync]);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      sync();
      refresh().catch(() => {});
    };
    const off = () => setOnline(false);
    const focus = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [sync, refresh]);
  useEffect(() => {
    if (state && !selected && state.vehicles.length)
      setSelected(
        state.settings.last_vehicle ||
          state.vehicles.find((v) => v.status === "active")?.id ||
          state.vehicles[0].id,
      );
  }, [state, selected]);
  async function save(
    entity: Mutation["entity"],
    data: Record<string, any>,
    record?: RecordBase,
    action: Mutation["action"] = record ? "update" : "create",
  ) {
    if (!session || !state) throw new Error("Гараж ещё загружается");
    const operation: Mutation = {
      operation_id: crypto.randomUUID(),
      id: record?.id || crypto.randomUUID(),
      entity,
      action,
      data,
      ...(record ? { expected_version: record.version } : {}),
    };
    if (navigator.onLine && queue.length === 0) {
      try {
        const result = await api<{ record: RecordBase }>(
          "/mutate",
          { method: "POST", body: JSON.stringify(operation) },
          session.csrf,
        );
        await refresh();
        return result.record;
      } catch (error) {
        if (error instanceof APIError) throw error;
      }
    }
    const next = await enqueue(session, state, operation);
    client.setQueryData(["state", session.id], next);
    setQueue(await queueFor(session.id));
    notify("Сохранено на устройстве · ожидает синхронизации");
    sync();
    return {
      ...data,
      id: operation.id,
      version: 1,
      pending: true,
    } as RecordBase;
  }
  async function upload(file: File, data: Record<string, string>) {
    if (!navigator.onLine)
      throw new Error(
        "Файлы можно загрузить при подключении к серверу. Запись уже сохранена.",
      );
    const body = new FormData();
    body.append("file", file);
    for (const [key, value] of Object.entries(data))
      if (value) body.append(key, value);
    const result = await api<Attachment>(
      "/attachments",
      { method: "POST", body },
      session!.csrf,
    );
    await refresh();
    return result;
  }
  async function logout() {
    if (
      queue.length &&
      !confirm(
        "Есть несинхронизированные записи. При выходе локальные данные будут удалены. Выйти?",
      )
    )
      return;
    await api("/logout", { method: "POST" }, session!.csrf);
    await clearLocal();
    client.clear();
    setSession(null);
    setQueue([]);
    setSelected("");
    setPage("garage");
  }
  async function resetDemo() {
    if (!confirm("Сбросить изменения демонстрационного гаража?")) return;
    const next = await api<Session>("/demo", { method: "POST" });
    await clearLocal();
    client.clear();
    setSelected("");
    setSession(next);
    setPage("garage");
    notify("Демогараж восстановлен");
  }
  if (boot)
    return (
      <div className="app-loader">
        <CarFront size={32} />
        <span>MASHINA</span>
        <div className="loading-line" />
      </div>
    );
  if (!session) return <Auth onSession={setSession} />;
  if (query.isLoading || !state) {
    return (
      <div className="app-loader">
        <CarFront size={32} />
        {query.error ? (
          <>
            <p role="alert">{(query.error as Error).message}</p>
            <Button onClick={() => query.refetch()}>Попробовать снова</Button>
            <Button variant="ghost" onClick={() => setSession(null)}>
              Войти заново
            </Button>
          </>
        ) : (
          <>
            <span>Открываем гараж…</span>
            <div className="loading-line" />
          </>
        )}
      </div>
    );
  }
  const model = {
    state,
    session,
    selected,
    setSelected,
    page,
    setPage,
    open: (
      type: Kind | "vehicle" | "reminder" | "document" | "category" | "quick",
      record?: RecordBase,
    ) => setModal({ type, record }),
    save,
    refresh,
    notify,
    upload,
    logout,
    queue,
    sync,
    resetDemo,
  };
  const failed = queue.filter((o) => o.error);
  return (
    <AppContext.Provider value={model}>
      <div className="app-shell">
        <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
          <a
            className="wordmark"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("garage");
            }}
          >
            <span className="brand-mark">
              <CarFront size={20} />
            </span>
            MASHINA<span className="brand-dot">®</span>
          </a>
          <button
            className="mobile-menu-close icon-button"
            aria-label="Закрыть меню"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
          <div className="sidebar-caption">ВАШ ЛИЧНЫЙ ГАРАЖ</div>
          <nav aria-label="Главная навигация">
            {navigation.map(([id, label, Icon]) => (
              <button
                key={id}
                className={`nav-item ${page === id || (id === "garage" && page === "vehicle") ? "active" : ""}`}
                onClick={() => {
                  setPage(id);
                  setMenu(false);
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === "reminders" &&
                  state.reminders.some(
                    (r) => r.status === "soon" || r.status === "overdue",
                  ) && <i className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="owner-note">
              <ShieldCheck size={19} />
              <div>
                Полностью под контролем<small>Данные на вашем сервере</small>
              </div>
            </div>
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => {
                setPage("settings");
                setMenu(false);
              }}
            >
              <Settings size={19} />
              Настройки
            </button>
            <div className="profile">
              <span className="avatar">
                {session.demo ? "D" : session.username[0].toUpperCase()}
              </span>
              <div>
                {session.username}
                <small>
                  {session.demo ? "Изолированный деморежим" : "Владелец гаража"}
                </small>
              </div>
              <button
                aria-label="Сменить тему"
                className="icon-button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </aside>
        {menu && (
          <button
            className="menu-backdrop"
            aria-label="Закрыть меню"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="main-wrapper">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Открыть меню"
                onClick={() => setMenu(true)}
              >
                <Menu size={21} />
              </button>
              <CarFront size={17} />
              <span>Личное пространство</span>
              <span className="breadcrumb-slash">/</span>
              <strong>
                {page === "vehicle"
                  ? "Автомобиль"
                  : navigation.find((n) => n[0] === page)?.[1] || "Настройки"}
              </strong>
            </div>
            <div className="topbar-right">
              <button
                className={`sync-badge ${!online || queue.length ? "pending" : ""}`}
                onClick={sync}
                title="Синхронизировать"
              >
                {syncing ? (
                  <RefreshCw size={13} className="spin" />
                ) : !online ? (
                  <CloudOff size={13} />
                ) : (
                  <Check size={13} />
                )}
                <span>
                  {!online
                    ? "Офлайн"
                    : queue.length
                      ? `${queue.length} в очереди`
                      : "Всё сохранено"}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label="Напоминания"
                onClick={() => setPage("reminders")}
              >
                <Bell size={19} />
              </button>
            </div>
          </header>
          {session.demo && (
            <div className="demo-banner">
              <span>
                <i />
                ДЕМО-ГАРАЖ{" "}
                <span className="demo-description">
                  · Вымышленные данные, полностью изолированные от личных
                </span>
              </span>
              <button onClick={resetDemo}>
                Сбросить демо
                <RefreshCw size={12} />
              </button>
            </div>
          )}
          {failed.length > 0 && (
            <div className="conflict-box" role="alert">
              {failed.map((o) => (
                <div key={o.operation_id}>
                  <strong>Не удалось синхронизировать</strong>
                  <p>{o.error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (o.status === 401) {
                          setSession(null);
                          return;
                        }
                        await resolveOperation(session, o, true);
                        await refresh();
                        await sync();
                      } catch (error) {
                        notify((error as Error).message);
                      }
                    }}
                  >
                    {o.status === 401
                      ? "Войти заново"
                      : "Повторить с моей версией"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        confirm(
                          "Удалить локальное изменение и оставить серверную запись?",
                        )
                      ) {
                        await resolveOperation(session, o, false);
                        await refresh();
                      }
                    }}
                  >
                    Оставить серверную
                  </Button>
                </div>
              ))}
            </div>
          )}
          <main>
            {page === "garage" ? (
              <Garage />
            ) : page === "vehicle" ? (
              <VehiclePage />
            ) : page === "timeline" ? (
              <Timeline />
            ) : page === "fuel" ? (
              <FuelPage />
            ) : page === "maintenance" ? (
              <Maintenance />
            ) : page === "analytics" ? (
              <Suspense
                fallback={
                  <div
                    className="skeleton-panel"
                    aria-label="Загрузка аналитики"
                  />
                }
              >
                <Analytics />
              </Suspense>
            ) : page === "documents" ? (
              <Documents />
            ) : page === "reminders" ? (
              <Reminders />
            ) : (
              <SettingsPage />
            )}
          </main>
          <footer className="main-footer">
            <span>MASHINA · с заботой о каждой детали</span>
            <span>
              <span className="status-dot" />
              {session.demo
                ? "Демонстрационный гараж"
                : "Ваш сервер · ваши данные"}
            </span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          <button
            className={page === "garage" || page === "vehicle" ? "active" : ""}
            onClick={() => setPage("garage")}
          >
            <LayoutGrid size={21} />
            <span>Гараж</span>
          </button>
          <button
            className={page === "timeline" ? "active" : ""}
            onClick={() => setPage("timeline")}
          >
            <Clock3 size={21} />
            <span>История</span>
          </button>
          <button
            className="quick-add-mobile"
            aria-label="Добавить запись"
            onClick={() => setModal({ type: "quick" })}
          >
            <Plus size={27} />
          </button>
          <button
            className={page === "analytics" ? "active" : ""}
            onClick={() => setPage("analytics")}
          >
            <ChartNoAxesCombined size={21} />
            <span>Аналитика</span>
          </button>
          <button onClick={() => setMenu(true)}>
            <Menu size={21} />
            <span>Ещё</span>
          </button>
        </nav>
        <button
          className="desktop-fab"
          onClick={() => setModal({ type: "quick" })}
        >
          <Plus size={20} />
          Добавить запись
        </button>
        {modal?.type === "quick" ? (
          <Sheet open onClose={() => setModal(null)} title="Что запишем?">
            <p className="muted sheet-intro">
              Каждая деталь становится частью истории.
            </p>
            <div className="quick-actions">
              {(
                [
                  ["fuel", "Заправка", "Литры, стоимость и пробег", Fuel],
                  ["expense", "Расход", "Любая покупка для автомобиля", Plus],
                  [
                    "maintenance",
                    "ТО / ремонт",
                    "Работы, запчасти и документы",
                    Wrench,
                  ],
                  [
                    "odometer",
                    "Обновить пробег",
                    "Зафиксировать показание одометра",
                    CarFront,
                  ],
                  [
                    "note",
                    "Заметка / событие",
                    "Важное, что хочется сохранить",
                    Clock3,
                  ],
                ] as const
              ).map(([kind, title, desc, Icon]) => (
                <button key={kind} onClick={() => setModal({ type: kind })}>
                  <span className={`event-icon ${kind}`}>
                    <Icon size={22} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          </Sheet>
        ) : (
          modal && (
            <RecordForm
              type={modal.type}
              record={modal.record}
              onClose={() => setModal(null)}
            />
          )
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.();
                  setToast(null);
                }}
              >
                Отменить
              </button>
            )}
            <button
              aria-label="Закрыть уведомление"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
