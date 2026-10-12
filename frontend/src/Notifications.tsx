import { intlLocale } from "./i18n";
import { tr } from "./i18n";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ShieldCheck,
  Smartphone,
  Send,
  RefreshCw,
  Pause,
} from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";

interface NotificationStatus {
  enabled: boolean;
  paused_after_restore: boolean;
  push_configured: boolean;
  public_key: string;
  telegram_configured: boolean;
  bot_username: string;
  telegram_linked: boolean;
  push: { id: string; label: string; active: boolean }[];
  deliveries: {
    id: string;
    channel: string;
    state: string;
    attempts: number;
    updated: number;
    retry_at: number;
    error_code: string;
  }[];
}

const states: Record<string, string> = {
  ready: "Ожидает запуска таймера",
  sending: "Запрос выполняется",
  accepted: "Принято сервисом",
  rejected: "Сервис отклонил запрос",
  uncertain: "Результат неизвестен",
  cancelled: "Отменено",
  delayed: "Сервис попросил подождать",
};

function applicationKey(value: string) {
  const decoded = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
}

export default function Notifications() {
  const { session } = useApp();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<{ code: string; expires: number } | null>(
    null,
  );
  const [current, setCurrent] = useState("");
  const [deviceLabel, setDeviceLabel] = useState(tr("Это устройство"));
  const supported =
    typeof PushManager !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    window.isSecureContext;
  const status = useQuery({
    queryKey: ["notifications", session.id],
    queryFn: () => api<NotificationStatus>("/notifications"),
    enabled: open && !session.demo,
    retry: false,
  });
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await status.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openSheet() {
    setError("");
    setCode(null);
    setConsent(false);
    setOpen(true);
    if (supported && !session.demo) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const result = await api<{ id: string }>(
            "/notifications/push/current",
            {
              method: "POST",
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            },
            session.csrf,
          );
          setCurrent(result.id);
        } else setCurrent("");
      } catch {
        setCurrent("");
      }
    }
  }
  const data = status.data;
  return (
    <>
      <Button variant="outline" onClick={() => void openSheet()}>
        <Bell size={17} />
        {tr("Уведомления")}
      </Button>
      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={tr("Важное — вовремя")}
      >
        <div className="notification-content">
          <p className="muted">
            {tr(
              "Напоминания об обслуживании. Только для владельцев автомобилей, по внесённым датам и подтверждённому пробегу.",
            )}
          </p>
          <div className="info-box">
            <ShieldCheck size={20} />
            <p>
              {tr(
                "Сообщение содержит только «MASHINA: есть напоминание об обслуживании». Данные машины и работ остаются на сервере. Push использует внешний сервис браузера; Telegram получает текст сообщения. Уведомление может быть видно на заблокированном экране.",
              )}
            </p>
          </div>
          {session.demo ? (
            <div className="info-box">
              {tr(
                "Демогараж изолирован: он не подключается к внешним сервисам. Настройка каналов доступна в личном гараже.",
              )}
            </div>
          ) : (
            <>
              {status.isPending && (
                <p role="status">{tr("Проверяем настройки сервера…")}</p>
              )}
              {status.isError && (
                <div className="error-box" role="alert">
                  {tr(status.error.message)}
                  <Button variant="ghost" onClick={() => void status.refetch()}>
                    {tr("Повторить")}
                  </Button>
                </div>
              )}
              {data && (
                <>
                  {data.paused_after_restore && (
                    <div className="info-box">
                      <Pause size={18} />
                      {tr(
                        "После восстановления отправка приостановлена. Владелец сервера должен выполнить notification-resume; затем включите свои каналы.",
                      )}
                    </div>
                  )}
                  <div className="section-heading">
                    <h3>{tr("Ваши каналы")}</h3>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        perform(() =>
                          api(
                            "/notifications",
                            {
                              method: "PATCH",
                              body: JSON.stringify({ enabled: !data.enabled }),
                            },
                            session.csrf,
                          ),
                        )
                      }
                    >
                      {data.enabled ? tr("Приостановить") : tr("Включить")}
                    </Button>
                  </div>
                  <p className="tiny muted">
                    {data.enabled
                      ? tr("Ваше согласие активно.")
                      : tr("Ваши каналы приостановлены.")}{" "}
                    {tr(
                      "Отправку запускает настроенный владельцем сервера таймер. Принятие сервисом не гарантирует показ или прочтение.",
                    )}
                  </p>
                  <section className="notification-channel">
                    <div className="notification-title">
                      <Smartphone size={22} />
                      <h3>{tr("На это устройство")}</h3>
                    </div>
                    {!data.push_configured ? (
                      <p className="muted">
                        {tr(
                          "Web Push пока не настроен. Владелец сервера создаёт локальные ключи командой notification-keys и включает таймер. Остальное приложение работает без уведомлений.",
                        )}
                      </p>
                    ) : !supported ? (
                      <p className="muted">
                        {tr(
                          "Этот браузер не предоставляет Web Push. На iPhone добавьте MASHINA на экран «Домой» и откройте её оттуда. Нужен HTTPS и поддержка уведомлений браузером.",
                        )}
                      </p>
                    ) : (
                      <>
                        {Notification.permission === "denied" && (
                          <p className="muted">
                            {tr(
                              "Уведомления запрещены в настройках браузера. Разрешите их для MASHINA и откройте панель снова.",
                            )}
                          </p>
                        )}
                        {current ? (
                          <p className="status-chip">
                            <ShieldCheck size={14} />
                            {tr("Это устройство подключено")}
                          </p>
                        ) : (
                          <>
                            <label className="notification-device-label">
                              {tr("Название устройства")}
                              <input
                                maxLength={60}
                                value={deviceLabel}
                                onChange={(event) =>
                                  setDeviceLabel(event.target.value)
                                }
                              />
                            </label>
                            <label className="notification-consent">
                              <input
                                type="checkbox"
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                              />
                              {tr(
                                "Я согласен использовать сервис браузера для таких уведомлений.",
                              )}
                            </label>
                            <Button
                              disabled={
                                busy ||
                                !consent ||
                                Notification.permission === "denied" ||
                                data.paused_after_restore
                              }
                              onClick={() => {
                                const permission =
                                  Notification.requestPermission();
                                void perform(async () => {
                                  if ((await permission) !== "granted")
                                    throw new Error(
                                      tr(
                                        "Разрешение не получено. Уведомления не подключены.",
                                      ),
                                    );
                                  const registration =
                                    await navigator.serviceWorker.ready;
                                  let subscription =
                                    await registration.pushManager.getSubscription();
                                  if (subscription) {
                                    const existing =
                                      subscription.options.applicationServerKey;
                                    const expected = applicationKey(
                                      data.public_key,
                                    );
                                    if (
                                      !existing ||
                                      new Uint8Array(existing).some(
                                        (byte, i) => byte !== expected[i],
                                      ) ||
                                      existing.byteLength !== expected.length
                                    ) {
                                      await subscription.unsubscribe();
                                      subscription = null;
                                    }
                                  }
                                  subscription ??=
                                    await registration.pushManager.subscribe({
                                      userVisibleOnly: true,
                                      applicationServerKey: applicationKey(
                                        data.public_key,
                                      ),
                                    });
                                  const result = await api<{ id: string }>(
                                    "/notifications/push",
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        ...subscription.toJSON(),
                                        label: deviceLabel,
                                      }),
                                    },
                                    session.csrf,
                                  );
                                  setCurrent(result.id);
                                });
                              }}
                            >
                              <Bell size={16} />
                              {tr("Подключить устройство")}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {data.push.length > 0 && (
                      <div className="notification-devices">
                        {data.push.map((device) => (
                          <div key={device.id}>
                            <span>
                              <strong>{device.label}</strong>
                              <small className="muted">
                                {device.active
                                  ? tr("Подписка активна")
                                  : tr("Подписка истекла — подключите снова")}
                              </small>
                            </span>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                perform(async () => {
                                  await api(
                                    `/notifications/push/${device.id}`,
                                    { method: "DELETE" },
                                    session.csrf,
                                  );
                                  if (device.id === current) {
                                    const subscription = await (
                                      await navigator.serviceWorker.ready
                                    ).pushManager.getSubscription();
                                    await subscription?.unsubscribe();
                                    setCurrent("");
                                  }
                                })
                              }
                            >
                              {tr("Отключить")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="notification-channel">
                    <div className="notification-title">
                      <Send size={22} />
                      <h3>{tr("В Telegram")}</h3>
                    </div>
                    {!data.telegram_configured ? (
                      <p className="muted">
                        {tr(
                          "Бот пока не настроен владельцем сервера. Токен хранится только на сервере и не вводится в приложении.",
                        )}
                      </p>
                    ) : data.telegram_linked ? (
                      <>
                        <p className="muted">
                          {tr("Личный чат подтверждён одноразовым кодом.")}
                        </p>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            perform(() =>
                              api(
                                "/notifications/telegram",
                                { method: "DELETE" },
                                session.csrf,
                              ),
                            )
                          }
                        >
                          {tr("Отключить Telegram")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="muted">
                          {tr("Отправьте одноразовый код в личный чат")}{" "}
                          <a
                            href={`https://t.me/${data.bot_username}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            @{data.bot_username}
                          </a>
                          {tr(
                            ". Сервер подтвердит привязку при следующем запуске таймера. Telegram получит текст уведомления.",
                          )}
                        </p>
                        {code && (
                          <div className="notification-code">
                            <code>{code.code}</code>
                            <small>
                              {tr("Действует до")}{" "}
                              {new Date(code.expires * 1000).toLocaleTimeString(
                                intlLocale(),
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                              {tr(", один раз. Скопируйте и отправьте боту.")}
                            </small>
                          </div>
                        )}
                        <Button
                          disabled={busy || data.paused_after_restore}
                          onClick={() =>
                            perform(async () =>
                              setCode(
                                await api(
                                  "/notifications/telegram/code",
                                  { method: "POST" },
                                  session.csrf,
                                ),
                              ),
                            )
                          }
                        >
                          {tr("Получить код и подключить")}
                        </Button>
                      </>
                    )}
                  </section>
                  <div className="section-heading">
                    <h3>{tr("Последние попытки")}</h3>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void status.refetch()}
                    >
                      <RefreshCw size={15} />
                      {tr("Обновить")}
                    </Button>
                  </div>
                  {data.deliveries.length === 0 ? (
                    <p className="muted">
                      {tr(
                        "Отправок пока нет. Ближайшее напоминание появится здесь после запуска таймера.",
                      )}
                    </p>
                  ) : (
                    <div className="notification-journal">
                      {data.deliveries.map((item) => (
                        <article key={item.id}>
                          <div>
                            <strong>
                              {item.channel === "push"
                                ? tr("На устройство")
                                : "Telegram"}
                            </strong>
                            <small>
                              {new Date(item.updated * 1000).toLocaleString(
                                intlLocale(),
                              )}
                            </small>
                          </div>
                          <p>
                            {states[item.state] || tr("Неизвестное состояние")}
                          </p>
                          {item.error_code === "expired" && (
                            <small>
                              {tr(
                                "Сервис удалил подписку. Подключите устройство снова.",
                              )}
                            </small>
                          )}
                          {["uncertain", "rejected"].includes(item.state) &&
                            item.error_code !== "expired" && (
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    confirm(
                                      tr(
                                        "Сервис мог уже принять предыдущее уведомление. Повтор может создать дубликат. Поставить повтор в очередь?",
                                      ),
                                    )
                                  )
                                    void perform(() =>
                                      api(
                                        `/notifications/deliveries/${item.id}/retry`,
                                        {
                                          method: "POST",
                                          body: JSON.stringify({
                                            acknowledge_duplicates: true,
                                          }),
                                        },
                                        session.csrf,
                                      ),
                                    );
                                }}
                              >
                                {tr("Повторить явно")}
                              </Button>
                            )}
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <div className="error-box" role="alert">
              {tr(error)}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
