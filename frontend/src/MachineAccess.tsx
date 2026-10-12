import { intlLocale } from "./i18n";
import { tr } from "./i18n";
import { useEffect, useState } from "react";
import { Cable, Check, Copy, KeyRound, ShieldCheck, X } from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";

interface Credential {
  id: string;
  label: string;
  created: number;
  expires: number;
  revoked: number | null;
  write_enabled: boolean;
  vehicle_ids: string[];
}
interface Status {
  enabled: boolean;
  credentials: Credential[];
}

export default function MachineAccess() {
  const { session, state } = useApp();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [label, setLabel] = useState("");
  const [cars, setCars] = useState<string[]>([]);
  const [days, setDays] = useState("90");
  const [write, setWrite] = useState(false);
  const [consent, setConsent] = useState(false);
  const [secret, setSecret] = useState("");
  const [secretId, setSecretId] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const owned = state.vehicles.filter((v) => !v.deleted && v.is_original_owner);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    return () => {
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
    };
  }, []);
  async function load() {
    setStatus(await api<Status>("/machine/credentials"));
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? tr(
              "Не удалось связаться с сервером. Проверьте подключение и повторите запрос.",
            )
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    const dirty =
      label.trim() || cars.length || write || consent || days !== "90";
    if (
      !secret &&
      dirty &&
      !window.confirm(
        tr(
          "Закрыть без создания ключа? Выбранные параметры подключения будут потеряны.",
        ),
      )
    )
      return;
    if (
      secret &&
      !copied &&
      !window.confirm(
        tr(
          "Ключ больше не будет показан. Вы сохранили его в безопасном месте?",
        ),
      )
    )
      return;
    setSecret("");
    setCopied(false);
    setManual(false);
    setOpen(false);
    setLabel("");
    setCars([]);
    setDays("90");
    setWrite(false);
    setConsent(false);
  }
  async function create() {
    await perform(async () => {
      const result = await api<Credential & { secret: string }>(
        "/machine/credentials",
        {
          method: "POST",
          body: JSON.stringify({
            label: label.trim(),
            vehicle_ids: cars,
            expires_days: Number(days),
            write_enabled: write,
          }),
        },
        session.csrf,
      );
      setSecret(result.secret);
      setSecretId(result.id);
      setCopied(false);
      setManual(false);
      setLabel("");
      setCars([]);
      setConsent(false);
      setWrite(false);
      setDays("90");
      await load();
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setManual(false);
    } catch {
      setManual(true);
    }
  }
  const valid =
    label.trim().length > 0 &&
    cars.length > 0 &&
    consent &&
    Number.isInteger(Number(days)) &&
    Number(days) >= 1 &&
    Number(days) <= 365;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setStatus(null);
          setSecret("");
          setError("");
          if (navigator.onLine) void perform(load);
        }}
      >
        <Cable size={17} />
        {tr("API и интеграции")}
      </Button>
      <Sheet
        open={open}
        title={tr("Доступ под вашим контролем")}
        onClose={close}
      >
        <div className="machine-access">
          <div className="machine-intro">
            <span className="machine-symbol">
              <KeyRound size={25} />
            </span>
            <div>
              <span className="eyebrow">
                {tr("ТОЛЬКО ТО, ЧТО ВЫ РАЗРЕШИЛИ")}
              </span>
              <h3>{tr("Ваш гараж. Ваши подключения.")}</h3>
              <p className="muted">
                {tr(
                  "Ограниченные ключи для собственного API-клиента и MCP. Документы, банковские связи и настройки остаются закрыты.",
                )}
              </p>
            </div>
          </div>
          {!online && (
            <div className="info-box" role="status">
              {tr(
                "Управление ключами доступно при подключении к серверу. Офлайн-изменения доступа не сохраняются.",
              )}
            </div>
          )}
          {error && (
            <div className="error-box" role="alert">
              {tr(error)}
            </div>
          )}
          {!status && !busy && online && (
            <Button variant="outline" onClick={() => void perform(load)}>
              {tr("Повторить загрузку")}
            </Button>
          )}
          {busy && (
            <p className="muted" role="status">
              {tr("Связываемся с сервером…")}
            </p>
          )}
          {status && !status.enabled && (
            <div className="info-box">
              {session.demo ? (
                tr("Демогараж изолирован: реальные ключи здесь не создаются.")
              ) : (
                <>
                  {tr(
                    "Интеграции выключены по умолчанию. Владелец сервера может задать ",
                  )}
                  <code>MASHINA_API_ENABLED=1</code>{" "}
                  {tr(" и перезапустить приложение.")}
                </>
              )}
            </div>
          )}
          {secret && (
            <section className="machine-secret" aria-label={tr("Новый ключ")}>
              <ShieldCheck size={23} />
              <h3>{tr("Сохраните ключ сейчас")}</h3>
              <p>
                {tr(
                  "Он показывается один раз. Храните его как пароль; не вставляйте в адрес страницы или публичные файлы.",
                )}
              </p>
              <label htmlFor="machine-secret">{tr("Ваш новый ключ")}</label>
              <textarea
                id="machine-secret"
                value={secret}
                readOnly
                rows={3}
                spellCheck={false}
                autoComplete="off"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button onClick={() => void copy()}>
                <Copy size={16} />
                {copied ? tr("Ключ скопирован") : tr("Скопировать ключ")}
              </Button>
              {manual && (
                <p role="status">
                  {tr(
                    "Выделите ключ в поле и скопируйте вручную: браузер не разрешил доступ к буферу.",
                  )}
                </p>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    copied ||
                    window.confirm(
                      tr("Ключ больше не будет показан. Вы сохранили его?"),
                    )
                  ) {
                    setSecret("");
                    setManual(false);
                  }
                }}
              >
                {tr("Я сохранил ключ")}
              </Button>
            </section>
          )}
          {status?.enabled && !secret && (
            <form
              className="machine-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid && online && !busy) void create();
              }}
            >
              <h3>{tr("Новое подключение")}</h3>
              <label htmlFor="machine-label">
                {tr("Название подключения")}
              </label>
              <input
                id="machine-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={tr("Например, мой MCP-клиент")}
                maxLength={80}
              />
              <fieldset>
                <legend>{tr("Разрешённые автомобили")}</legend>
                {owned.map((v) => (
                  <label className="machine-option" key={v.id}>
                    <input
                      type="checkbox"
                      aria-label={v.name}
                      checked={cars.includes(v.id)}
                      onChange={(e) =>
                        setCars((current) =>
                          e.target.checked
                            ? [...current, v.id]
                            : current.filter((id) => id !== v.id),
                        )
                      }
                    />
                    <span>
                      {v.name}
                      <small className="muted">
                        {tr("Только этот автомобиль")}
                      </small>
                    </span>
                    {cars.includes(v.id) && <Check size={16} />}
                  </label>
                ))}
                {!owned.length && (
                  <p className="muted">
                    {tr(
                      "Ключ можно выдать только для автомобиля, который создали вы.",
                    )}
                  </p>
                )}
              </fieldset>
              <label htmlFor="machine-days">{tr("Срок действия, дней")}</label>
              <input
                id="machine-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <label className="machine-option">
                <input
                  type="checkbox"
                  checked={write}
                  onChange={(e) => setWrite(e.target.checked)}
                />
                <span>
                  {tr("Разрешить создание и изменение записей")}
                  <small className="muted">
                    {tr("По умолчанию доступно только чтение")}
                  </small>
                </span>
              </label>
              {write && (
                <div className="info-box">
                  {tr(
                    "Клиент сможет менять расходы, заправки, обслуживание и напоминания выбранных автомобилей. Профили, документы и права доступа изменять нельзя.",
                  )}
                </div>
              )}
              <label className="machine-option">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {tr("Доверяю этому клиенту историю выбранных автомобилей")}
                  <small className="muted">
                    {tr(
                      "Описания, названия деталей и заметки в записях могут содержать личные сведения. Новые автомобили автоматически не добавляются.",
                    )}
                  </small>
                </span>
              </label>
              <Button type="submit" disabled={!valid || !online || busy}>
                <KeyRound size={17} />
                {tr("Создать ключ")}
              </Button>
            </form>
          )}
          {!!status?.credentials.length && (
            <section className="machine-list">
              <h3>{tr("Подключения")}</h3>
              {status.credentials.map((key) => {
                const inactive =
                  key.revoked !== null || key.expires * 1000 <= Date.now();
                return (
                  <article className="machine-key" key={key.id}>
                    <div>
                      <strong>{key.label}</strong>
                      <span className="tiny muted">
                        {key.write_enabled
                          ? tr("Чтение и запись")
                          : tr("Только чтение")}{" "}
                        · {key.vehicle_ids.length} {tr(" авто")}
                      </span>
                      <span className="tiny muted">
                        {key.vehicle_ids
                          .map(
                            (id) =>
                              state.vehicles.find(
                                (vehicle) => vehicle.id === id,
                              )?.name || tr("Недоступный автомобиль"),
                          )
                          .join(" · ")}
                      </span>
                      <span className="tiny muted">
                        {key.revoked !== null
                          ? tr("Ключ отозван")
                          : key.expires * 1000 <= Date.now()
                            ? tr("Срок истёк")
                            : tr("До {0}", [
                                new Date(key.expires * 1000).toLocaleDateString(
                                  intlLocale(),
                                ),
                              ])}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      disabled={inactive || busy || !online}
                      aria-label={tr("Отозвать {0}", [key.label])}
                      onClick={() => {
                        if (
                          window.confirm(
                            tr(
                              "Отозвать доступ «{0}»? Клиент больше не сможет обращаться к гаражу.",
                              [key.label],
                            ),
                          )
                        )
                          void perform(async () => {
                            await api(
                              `/machine/credentials/${key.id}`,
                              { method: "DELETE" },
                              session.csrf,
                            );
                            if (key.id === secretId) setSecret("");
                            await load();
                          });
                      }}
                    >
                      <X size={17} />
                      {inactive ? tr("Закрыт") : tr("Отозвать")}
                    </Button>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </Sheet>
    </>
  );
}
