import { createUuid } from "./uuid";
import { tr } from "./i18n";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import type { MouseEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getLocale, isLocale, setLocale, useLocale } from "./i18n";
import { localizeDemo } from "./demoLocale";
import { LanguagePicker } from "./LanguagePicker";
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
  CircleDot,
} from "lucide-react";
import type {
  Kind,
  Page,
  RecordBase,
  State,
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
  receiptDrafts,
  resolveOperation,
} from "./offline";
import { AppContext, type RecordFormOptions } from "./context";
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
import { permissionError, scopeKey } from "./permissions";
import { BrandMark } from "./BrandMark";
import "./app-shell-polish.css";
const Analytics = lazy(() => import("./Analytics"));
const OwnershipTools = lazy(() => import("./OwnershipTools"));
const Renewals = lazy(() => import("./VehicleRenewals"));
const navigation = [
  ["garage", "Мой гараж", LayoutGrid],
  ["timeline", "История", Clock3],
  ["fuel", "Заправки", Fuel],
  ["maintenance", "Обслуживание", Wrench],
  ["tires", "Шины", CircleDot],
  ["analytics", "Аналитика", ChartNoAxesCombined],
  ["documents", "Документы", Files],
  ["renewals", "Регистрация и страховка", ShieldCheck],
  ["reminders", "Напоминания", Bell],
] as const;

const smallScreen = "(max-width: 760px)";
const shortScreen = "(max-height: 600px)";

function compactNavigation() {
  return (
    matchMedia(smallScreen).matches ||
    (document.documentElement.dataset.standalone === "true" &&
      matchMedia(shortScreen).matches)
  );
}

function currentSection(page: Page): Page {
  if (page === "vehicle") return "garage";
  if (page === "fuel-analytics") return "analytics";
  return page;
}

interface Toast {
  message: string;
  action?: () => void;
}

function Auth({ onSession }: { onSession: (session: Session) => void }) {
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ required: boolean }>("/setup")
      .then((r) => setSetup(r.required))
      .catch(() => setError(tr("Сервер недоступен. Проверьте соединение.")));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        locale: getLocale(),
      };
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
            <BrandMark />
          </span>
          MASHINA
        </a>
        <div className="auth-copy">
          <span className="eyebrow">
            {tr("ДЛЯ ТЕХ, КТО ЛЮБИТ СВОЮ МАШИНУ")}
          </span>
          <h1>
            {tr("Больше, чем")} <br />
            {tr("просто ")}
            <em>{tr("гараж.")}</em>
          </h1>
          <p>
            {tr("Каждая поездка. Каждая деталь.")}
            <br />
            {tr("Вся история ваших автомобилей — в одном месте.")}
          </p>
          <div className="auth-car">
            <img src="/volvo-demo.webp" alt={tr("Иллюстрация автомобиля")} />
          </div>
          <div className="auth-bottom">
            <ShieldCheck size={17} />{" "}
            {tr(" Ваш сервер. Ваши данные. Ваши правила.")}
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div>
          <span className="label-pill">
            {tr("ПЕРСОНАЛЬНЫЙ ЦИФРОВОЙ ГАРАЖ")}
          </span>
          <h2>{setup ? tr("Добро пожаловать.") : tr("С возвращением.")}</h2>
          <p className="muted">
            {setup
              ? tr("Создайте свой гараж. Всё остальное уже продумано.")
              : tr("Ваши автомобили и их истории ждут вас.")}
          </p>
          <LanguagePicker />
          <form onSubmit={submit} className="form-stack">
            <label>
              {tr("Имя пользователя")}
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={64}
                required
                placeholder={tr("Как к вам обращаться")}
              />
            </label>
            <label>
              {tr("Пароль")}
              <input
                name="password"
                type="password"
                autoComplete={setup ? "new-password" : "current-password"}
                minLength={12}
                maxLength={256}
                required
                placeholder={tr("Не менее 12 символов")}
              />
            </label>
            {setup && (
              <label>
                {tr("Одноразовый код установки")}
                <input
                  name="bootstrap_token"
                  type="password"
                  autoComplete="off"
                  required
                />
                <small>
                  {tr("Код из файла .bootstrap-token на вашем сервере.")}
                  <br />
                  {tr("Создайте его командой из инструкции установки.")}
                </small>
              </label>
            )}
            {error && (
              <div role="alert" className="error-box">
                {tr(error)}
              </div>
            )}
            <Button disabled={busy} type="submit">
              {busy
                ? tr("Подождите…")
                : setup
                  ? tr("Создать мой гараж")
                  : tr("Войти в гараж")}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="divider-label">{tr("СНАЧАЛА ПОЗНАКОМИМСЯ?")}</div>
          <Button
            variant="outline"
            className="full"
            disabled={busy}
            onClick={demo}
          >
            {tr("Посмотреть демогараж")}
            <ArrowUpRight size={18} />
          </Button>
          <p className="tiny muted centered">
            {tr("Вымышленные автомобили. Настоящие возможности.")}
            <br />
            {tr("Демо полностью изолировано от ваших данных.")}
          </p>
          <div className="auth-private">
            <LockKeyhole size={14} /> {tr(" Без облаков и скрытой телеметрии")}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  useLocale();
  const localeOwner = useRef("");
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [boot, setBoot] = useState(true);
  const [page, updatePage] = useState<Page>("garage");
  const [selected, setSelected] = useState("");
  const [queue, setQueue] = useState<Mutation[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [compact, setCompact] = useState(compactNavigation);
  const menuOpener = useRef<HTMLButtonElement | null>(null);
  const menuDestination = useRef<Page | null | undefined>(undefined);
  const lastPage = useRef(page);
  const garageScroll = useRef(0);
  const [theme, setTheme] = useState(
    localStorage.getItem("mashina-theme") || "dark",
  );
  const [modal, setModal] = useState<{
    type: Kind | "vehicle" | "reminder" | "document" | "category" | "quick";
    record?: RecordBase;
    options?: RecordFormOptions;
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = toasts[0];
  const setPage = useCallback(
    (next: Page) => {
      if (page === "garage" && next === "vehicle") {
        garageScroll.current = window.scrollY;
      }
      updatePage(next);
    },
    [page],
  );
  const notify = useCallback(
    (message: string, action?: () => void) =>
      setToasts((pending) => [
        ...pending.filter((item) => item.action),
        { message: tr(message), action },
      ]),
    [],
  );
  const dismissToast = useCallback(
    (item: Toast) =>
      setToasts((pending) => pending.filter((next) => next !== item)),
    [],
  );
  const closeMenu = useCallback(
    (next?: Page) => {
      setMenu(false);
      if (window.history.state?.mobileMenu === true) {
        menuDestination.current = next ?? null;
        window.history.back();
      } else if (next) {
        setPage(next);
      }
    },
    [setPage],
  );
  function openMenu(event: MouseEvent<HTMLButtonElement>) {
    if (!compact || menu) return;
    menuOpener.current = event.currentTarget;
    window.history.pushState({ page, selected, mobileMenu: true }, "");
    setMenu(true);
  }
  useEffect(() => {
    const media = [matchMedia(smallScreen), matchMedia(shortScreen)];
    const update = () => setCompact(compactNavigation());
    media.forEach((query) => query.addEventListener("change", update));
    return () =>
      media.forEach((query) => query.removeEventListener("change", update));
  }, []);
  useEffect(() => {
    if (!compact && menu) closeMenu();
  }, [closeMenu, compact, menu]);
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
    const t = setTimeout(
      () => dismissToast(toast),
      toast.action ? 15000 : 6000,
    );
    return () => clearTimeout(t);
  }, [dismissToast, toast]);
  const query = useQuery({
    queryKey: ["state", session?.id],
    queryFn: () => loadState(session!),
    enabled: !!session,
  });
  const state =
    session?.demo && query.data ? localizeDemo(query.data) : query.data;
  useEffect(() => {
    if (state && session && localeOwner.current !== session.id) {
      localeOwner.current = session.id;
      if (isLocale(state.settings.locale)) setLocale(state.settings.locale);
    }
  }, [state, session]);
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
    // Connectivity can change while an offline session is still booting and
    // before this session's listeners replace the initial unauthenticated ones.
    // Reconcile the actual state at subscription time as well as on events.
    if (navigator.onLine) on();
    else setOnline(false);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [sync, refresh]);
  useEffect(() => {
    if (
      state &&
      (!selected || !state.vehicles.some((v) => v.id === selected)) &&
      state.vehicles.length
    )
      setSelected(
        (state.vehicles.some(
          (v) =>
            v.id === localStorage.getItem(`mashina-selected:${session?.id}`),
        )
          ? localStorage.getItem(`mashina-selected:${session?.id}`)
          : "") ||
          (state.vehicles.some((v) => v.id === state.settings.last_vehicle)
            ? state.settings.last_vehicle
            : "") ||
          state.vehicles.find((v) => v.status === "active")?.id ||
          state.vehicles[0].id,
      );
  }, [state, selected]);
  const accessScope = state ? scopeKey(state) : "";
  useEffect(() => {
    if (!accessScope) return;
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "state" });
    setModal(null);
    if (state && !state.vehicles.length) {
      setSelected("");
      setPage("garage");
    }
  }, [accessScope, client]);
  async function save(
    entity: Mutation["entity"],
    data: Record<string, any>,
    record?: RecordBase,
    action: Mutation["action"] = record ? "update" : "create",
  ) {
    if (!session || !state) throw new Error(tr("Гараж ещё загружается"));
    const operation: Mutation = {
      operation_id: createUuid(),
      id: record?.id || createUuid(),
      entity,
      action,
      data,
      ...(record ? { expected_version: record.version } : {}),
    };
    const latest = client.getQueryData<State>(["state", session.id]) || state;
    const denied = permissionError(latest, operation);
    if (denied) throw new Error(denied);
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
    const next = await enqueue(session, latest, operation);
    client.setQueryData(["state", session.id], next);
    setQueue(await queueFor(session.id));
    notify(tr("Сохранено на устройстве · ожидает синхронизации"));
    sync();
    return {
      ...data,
      id: operation.id,
      version: (record?.version || 0) + 1,
      pending: true,
    } as RecordBase;
  }
  async function upload(file: File, data: Record<string, string>) {
    if (!navigator.onLine)
      throw new Error(
        tr(
          "Файлы можно загрузить при подключении к серверу. Запись уже сохранена.",
        ),
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
    const drafts = session ? await receiptDrafts(session.id) : [];
    if (
      (queue.length || drafts.length) &&
      !confirm(
        drafts.length
          ? tr(
              "При выходе локальные черновики чеков и несинхронизированные записи будут удалены. Выйти?",
            )
          : tr(
              "Есть несинхронизированные записи. При выходе локальные данные будут удалены. Выйти?",
            ),
      )
    )
      return;
    if (!navigator.onLine)
      throw new Error(
        tr(
          "Для завершения сеанса и отключения уведомлений подключитесь к серверу.",
        ),
      );
    const subscription =
      !session!.demo &&
      "serviceWorker" in navigator &&
      typeof PushManager !== "undefined"
        ? await (
            await navigator.serviceWorker.ready
          ).pushManager.getSubscription()
        : null;
    await api(
      "/logout",
      {
        method: "POST",
        body: JSON.stringify({ push_endpoint: subscription?.endpoint || "" }),
      },
      session!.csrf,
    );
    await subscription?.unsubscribe();
    await clearLocal();
    client.clear();
    setSession(null);
    setToasts([]);
    setQueue([]);
    setSelected("");
    setPage("garage");
  }
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const destination = menuDestination.current;
      if (menu || destination !== undefined) {
        menuDestination.current = undefined;
        setMenu(false);
        if (destination) setPage(destination);
        return;
      }
      if (event.state?.mobileMenu === true && compact) {
        setMenu(true);
        return;
      }
      if (modal) {
        setModal(null);
        return;
      }
      const nextPage = event.state?.page as Page | undefined;
      const nextSelected = event.state?.selected as string | undefined;
      if (nextPage) setPage(nextPage);
      if (nextSelected !== undefined) setSelected(nextSelected);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [compact, menu, modal, setPage]);
  useLayoutEffect(() => {
    if (!session) return;
    const current = window.history.state;
    if (current?.page !== page || current?.selected !== selected) {
      window.history.pushState({ page, selected }, "");
    }
  }, [session, page, selected]);
  useLayoutEffect(() => {
    const previous = lastPage.current;
    lastPage.current = page;
    if (page === "vehicle") {
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (page === "garage" && previous === "vehicle") {
      const frame = requestAnimationFrame(() => {
        window.scrollTo({ top: garageScroll.current, behavior: "instant" });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [page, selected]);
  useEffect(() => {
    if (session && selected)
      localStorage.setItem(`mashina-selected:${session.id}`, selected);
  }, [session, selected]);
  async function resetDemo() {
    if (!confirm(tr("Сбросить изменения демонстрационного гаража?"))) return;
    const next = await api<Session>("/demo", { method: "POST" });
    await clearLocal();
    client.clear();
    setSelected("");
    setSession(next);
    setPage("garage");
    setToasts([]);
    notify(tr("Демогараж восстановлен"));
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
            <p role="alert">{tr((query.error as Error).message)}</p>
            <Button onClick={() => query.refetch()}>
              {tr("Попробовать снова")}
            </Button>
            <Button variant="ghost" onClick={() => setSession(null)}>
              {tr("Войти заново")}
            </Button>
          </>
        ) : (
          <>
            <span>{tr("Открываем гараж…")}</span>
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
      options?: RecordFormOptions,
    ) => setModal({ type, record, options }),
    save,
    refresh,
    notify,
    upload,
    logout,
    queue,
    sync,
    resetDemo,
    updateSession: setSession,
  };
  const failed = queue.filter((o) => o.error);
  const activePage = currentSection(page);
  const navigateFromSidebar = (next: Page) =>
    menu ? closeMenu(next) : setPage(next);
  const sidebar = (
    <>
      <a
        className="wordmark"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          navigateFromSidebar("garage");
        }}
      >
        <span className="brand-mark">
          <BrandMark />
        </span>
        MASHINA
      </a>
      {compact && (
        <Dialog.Close
          className="mobile-menu-close icon-button"
          aria-label={tr("Закрыть меню")}
        >
          <X />
        </Dialog.Close>
      )}
      <div className="sidebar-caption">{tr("ВАШ ЛИЧНЫЙ ГАРАЖ")}</div>
      <nav aria-label={tr("Главная навигация")}>
        {navigation.map(([id, label, Icon]) => (
          <button
            key={id}
            className={`nav-item ${activePage === id ? "active" : ""}`}
            aria-current={activePage === id ? "page" : undefined}
            onClick={() => navigateFromSidebar(id)}
          >
            <Icon size={19} />
            <span>{tr(label)}</span>
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
            {tr("Полностью под контролем")}
            <small>{tr("Данные на вашем сервере")}</small>
          </div>
        </div>
        <button
          className={`nav-item ${page === "settings" ? "active" : ""}`}
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => navigateFromSidebar("settings")}
        >
          <Settings size={19} />
          {tr("Настройки")}
        </button>
        <div className="profile">
          <span className="avatar">
            {session.demo ? "D" : session.username[0].toUpperCase()}
          </span>
          <div>
            {session.demo ? tr("Демо-гараж") : session.username}
            <small>
              {session.demo
                ? tr("Изолированный деморежим")
                : session.is_admin
                  ? tr("Администратор")
                  : tr("Личный аккаунт")}
            </small>
          </div>
          <button
            aria-label={tr("Сменить тему")}
            className="icon-button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </>
  );
  return (
    <AppContext.Provider value={model}>
      <div className="app-shell">
        {!compact && <aside className="sidebar">{sidebar}</aside>}
        <Dialog.Root
          open={compact && menu}
          onOpenChange={(open) => {
            if (!open) closeMenu();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="menu-backdrop app-drawer-overlay" />
            <Dialog.Content
              id="mashina-mobile-navigation"
              className="sidebar sidebar-open app-mobile-drawer"
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                if (menuOpener.current?.getClientRects().length) {
                  event.preventDefault();
                  menuOpener.current.focus({ preventScroll: true });
                }
              }}
            >
              <Dialog.Title className="sr-only">
                {tr("Главная навигация")}
              </Dialog.Title>
              {sidebar}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <div className="main-wrapper">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label={tr("Открыть меню")}
                aria-haspopup="dialog"
                aria-expanded={menu}
                aria-controls={menu ? "mashina-mobile-navigation" : undefined}
                onClick={openMenu}
              >
                <Menu size={21} />
              </button>
              <CarFront size={17} />
              <span>{tr("Личное пространство")}</span>
              <span className="breadcrumb-slash">/</span>
              <strong>
                {page === "vehicle"
                  ? tr("Автомобиль")
                  : page === "fuel-analytics"
                    ? tr("Аналитика топлива")
                    : tr(
                        navigation.find((n) => n[0] === page)?.[1] ||
                          "Настройки",
                      )}
              </strong>
            </div>
            <div className="topbar-right">
              <button
                className={`sync-badge ${!online || queue.length ? "pending" : ""}`}
                onClick={sync}
                title={tr("Синхронизировать")}
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
                    ? tr("Офлайн")
                    : queue.length
                      ? tr("{0} в очереди", [queue.length])
                      : tr("Всё сохранено")}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={tr("Напоминания")}
                onClick={() => setPage("reminders")}
              >
                <Bell size={19} />
              </button>
              <button
                className="desktop-fab"
                onClick={() => setModal({ type: "quick" })}
              >
                <Plus size={17} />
                {tr("Добавить запись")}
              </button>
            </div>
          </header>
          {session.demo && (
            <div className="demo-banner">
              <span>
                <i />
                {tr("ДЕМО-ГАРАЖ")}{" "}
                <span className="demo-description">
                  {tr(
                    "· Вымышленные данные, полностью изолированные от личных",
                  )}
                </span>
              </span>
              <button onClick={resetDemo}>
                {tr("Сбросить демо")}
                <RefreshCw size={12} />
              </button>
            </div>
          )}
          {failed.length > 0 && (
            <div className="conflict-box" role="alert">
              {failed.map((o) => (
                <div key={o.operation_id}>
                  <strong>{tr("Не удалось синхронизировать")}</strong>
                  <p>{tr(o.error || "")}</p>
                  <p className="tiny muted">
                    {tr("Сохранённый черновик:")}{" "}
                    {o.data.description ||
                      o.data.title ||
                      o.data.name ||
                      tr("запись автомобиля")}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(o.data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "mashina-draft.json";
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {tr("Скачать черновик")}
                  </Button>
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
                      ? tr("Войти заново")
                      : o.status === 403
                        ? tr("Проверить доступ и повторить")
                        : tr("Повторить с моей версией")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        confirm(
                          tr(
                            "Удалить локальный черновик? Несохранённые изменения будут потеряны.",
                          ),
                        )
                      ) {
                        await resolveOperation(session, o, false);
                        await refresh();
                      }
                    }}
                  >
                    {o.status === 403
                      ? tr("Удалить черновик")
                      : tr("Оставить серверную")}
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
            ) : page === "tires" ? (
              <Suspense
                fallback={<p role="status">{tr("Открываем комплекты шин…")}</p>}
              >
                <OwnershipTools key="tires" tiresOnly />
              </Suspense>
            ) : page === "analytics" || page === "fuel-analytics" ? (
              <Suspense
                fallback={
                  <div
                    className="skeleton-panel"
                    aria-label={tr("Загрузка аналитики")}
                  />
                }
              >
                <Analytics key={page} fuel={page === "fuel-analytics"} />
              </Suspense>
            ) : page === "documents" ? (
              <Documents />
            ) : page === "renewals" ? (
              <Suspense fallback={<p role="status">{tr("Загрузка…")}</p>}>
                <Renewals />
              </Suspense>
            ) : page === "reminders" ? (
              <Reminders />
            ) : (
              <SettingsPage />
            )}
          </main>
          <footer className="main-footer">
            <span>{tr("MASHINA · с заботой о каждой детали")}</span>
            <span>
              <span className="status-dot" />
              {session.demo
                ? tr("Демонстрационный гараж")
                : tr("Ваш сервер · ваши данные")}
            </span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label={tr("Мобильная навигация")}>
          <button
            className={activePage === "garage" ? "active" : ""}
            aria-current={activePage === "garage" ? "page" : undefined}
            onClick={() => setPage("garage")}
          >
            <LayoutGrid size={21} />
            <span>{tr("Гараж")}</span>
          </button>
          <button
            className={activePage === "timeline" ? "active" : ""}
            aria-current={activePage === "timeline" ? "page" : undefined}
            onClick={() => setPage("timeline")}
          >
            <Clock3 size={21} />
            <span>{tr("История")}</span>
          </button>
          <button
            className="quick-add-mobile"
            aria-label={tr("Добавить запись")}
            onClick={() => setModal({ type: "quick" })}
          >
            <Plus size={27} />
          </button>
          <button
            className={activePage === "analytics" ? "active" : ""}
            aria-current={activePage === "analytics" ? "page" : undefined}
            onClick={() => setPage("analytics")}
          >
            <ChartNoAxesCombined size={21} />
            <span>{tr("Аналитика")}</span>
          </button>
          <button
            aria-haspopup="dialog"
            aria-expanded={menu}
            aria-controls={menu ? "mashina-mobile-navigation" : undefined}
            onClick={openMenu}
          >
            <Menu size={21} />
            <span>{tr("Ещё")}</span>
          </button>
        </nav>
        {modal?.type === "quick" ? (
          <Sheet open onClose={() => setModal(null)} title={tr("Что запишем?")}>
            <p className="muted sheet-intro">
              {tr("Каждая деталь становится частью истории.")}
            </p>
            <div className="quick-actions">
              {(
                [
                  [
                    "fuel",
                    tr("Заправка"),
                    tr("Литры, стоимость и пробег"),
                    Fuel,
                  ],
                  [
                    "expense",
                    tr("Расход"),
                    tr("Любая покупка для автомобиля"),
                    Plus,
                  ],
                  [
                    "maintenance",
                    tr("ТО / ремонт"),
                    tr("Работы, запчасти и документы"),
                    Wrench,
                  ],
                  [
                    "odometer",
                    tr("Обновить пробег"),
                    tr("Зафиксировать показание одометра"),
                    CarFront,
                  ],
                  [
                    "note",
                    tr("Заметка / событие"),
                    tr("Важное, что хочется сохранить"),
                    Clock3,
                  ],
                ] as const
              ).map(([kind, title, desc, Icon]) => (
                <button key={kind} onClick={() => setModal({ type: kind })}>
                  <span className={`event-icon ${kind}`}>
                    <Icon size={22} />
                  </span>
                  <span>
                    <strong>{tr(title)}</strong>
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
              {...modal.options}
            />
          )
        )}
        {toast && (
          <div className="toast">
            <Check size={17} aria-hidden="true" />
            <span role="status">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  dismissToast(toast);
                  toast.action?.();
                }}
              >
                {tr("Отменить")}
              </button>
            )}
            <button
              aria-label={tr("Закрыть уведомление")}
              onClick={() => dismissToast(toast)}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
