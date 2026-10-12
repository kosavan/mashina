import { tr } from "./i18n";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, LockKeyhole, Plus, UserRound, ShieldCheck } from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import type { Session } from "./types";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";

interface Account {
  id: string;
  username: string;
  is_admin: boolean;
  disabled: boolean;
}
interface Access {
  original_owner: { user_id: string; username: string };
  members: {
    user_id: string;
    username: string;
    role: string;
    disabled: boolean;
  }[];
  candidates: { id: string; username: string }[];
}

export default function Sharing({ vehicleId }: { vehicleId?: string }) {
  const { session, refresh, notify, updateSession } = useApp();
  const [sheet, setSheet] = useState<"access" | "accounts" | "password" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState<Account | null>(null);
  const access = useQuery({
    queryKey: ["access", session.id, vehicleId],
    queryFn: () => api<Access>(`/vehicles/${vehicleId}/access`),
    enabled: sheet === "access" && !!vehicleId,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: ["accounts", session.id],
    queryFn: () => api<Account[]>("/users"),
    enabled: sheet === "accounts",
    retry: false,
  });
  function open(next: typeof sheet) {
    setError("");
    setReset(null);
    setSheet(next);
  }
  async function change(path: string, method: string, data?: object) {
    setBusy(true);
    setError("");
    try {
      await api(
        path,
        { method, ...(data ? { body: JSON.stringify(data) } : {}) },
        session.csrf,
      );
      if (sheet === "access") await access.refetch();
      if (sheet === "accounts") await accounts.refetch();
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (session.demo) return null;
  return (
    <>
      {vehicleId ? (
        <Button variant="outline" onClick={() => open("access")}>
          <Users size={16} />
          {tr("Доступ")}
        </Button>
      ) : (
        <div className="settings-actions">
          <Button variant="outline" onClick={() => open("password")}>
            <LockKeyhole size={16} />
            {tr("Изменить пароль")}
          </Button>
          {session.is_admin && (
            <Button variant="outline" onClick={() => open("accounts")}>
              <Users size={16} />
              {tr("Пользователи")}
            </Button>
          )}
        </div>
      )}
      <Sheet
        open={!!sheet}
        onClose={() => {
          if (!busy) open(null);
        }}
        title={
          sheet === "access"
            ? tr("Вместе в одном гараже")
            : sheet === "accounts"
              ? tr("Близкие и водители")
              : tr("Новый пароль")
        }
      >
        <div className="sharing-content">
          {error && (
            <div className="error-box" role="alert">
              {tr(error)}
            </div>
          )}
          {((access.error && sheet === "access") ||
            (accounts.error && sheet === "accounts")) && (
            <div role="alert" className="error-box">
              {
                ((sheet === "access" ? access.error : accounts.error) as Error)
                  .message
              }
            </div>
          )}
          {sheet === "access" && (
            <div className="form-stack">
              <p className="muted">
                {tr(
                  "Водитель видит историю и добавляет свои записи. Владелец управляет автомобилем, всеми записями и доступом. Личные документы остаются закрытыми, пока владелец явно не поделится ими.",
                )}
              </p>
              {access.isLoading && (
                <p role="status">{tr("Загружаем участников…")}</p>
              )}
              {access.data && (
                <>
                  <div className="sharing-member">
                    <span className="event-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <strong>{access.data.original_owner.username}</strong>
                      <small>
                        {tr("Исходный владелец · доступ сохраняется всегда")}
                      </small>
                    </div>
                  </div>
                  {access.data.members.map((member) => (
                    <div className="sharing-member" key={member.user_id}>
                      <span className="event-icon">
                        <UserRound size={20} />
                      </span>
                      <div>
                        <strong>{member.username}</strong>
                        <small>
                          {member.disabled
                            ? tr("Аккаунт отключён")
                            : member.role === "owner"
                              ? tr("Владелец")
                              : tr("Водитель")}
                        </small>
                      </div>
                      <select
                        aria-label={tr("Роль {0}", [member.username])}
                        value={member.role}
                        disabled={busy || member.disabled}
                        onChange={(e) => {
                          void change(
                            `/vehicles/${vehicleId}/access/${member.user_id}`,
                            "PUT",
                            { role: e.target.value },
                          );
                        }}
                      >
                        <option value="driver">{tr("Водитель")}</option>
                        <option value="owner">{tr("Владелец")}</option>
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              tr(
                                "Отозвать доступ {0}? Уже сохранённые данные на отключённом устройстве удалённо не стираются.",
                                [member.username],
                              ),
                            )
                          )
                            void change(
                              `/vehicles/${vehicleId}/access/${member.user_id}`,
                              "DELETE",
                            );
                        }}
                      >
                        {tr("Отозвать")}
                      </Button>
                    </div>
                  ))}
                  <form
                    className="form-stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const values = new FormData(form);
                      if (
                        await change(
                          `/vehicles/${vehicleId}/access/${values.get("user")}`,
                          "PUT",
                          { role: values.get("role") },
                        )
                      ) {
                        form.reset();
                        notify(tr("Доступ предоставлен"));
                      }
                    }}
                  >
                    <h3>{tr("Пригласить в автомобиль")}</h3>
                    <label>
                      {tr("Пользователь")}
                      <select name="user" required defaultValue="">
                        <option value="" disabled>
                          {tr("Выберите аккаунт")}
                        </option>
                        {access.data.candidates
                          .filter(
                            (u) =>
                              u.id !== access.data!.original_owner.user_id &&
                              !access.data!.members.some(
                                (m) => m.user_id === u.id,
                              ),
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {tr("Права")}
                      <select name="role" defaultValue="driver">
                        <option value="driver">
                          {tr("Водитель — свои записи")}
                        </option>
                        <option value="owner">
                          {tr("Владелец — управление автомобилем")}
                        </option>
                      </select>
                    </label>
                    <Button disabled={busy}>
                      <Plus size={16} />
                      {tr("Предоставить доступ")}
                    </Button>
                    <small className="muted">
                      {tr(
                        "Новый аккаунт создаёт администратор в настройках. Пароль передайте человеку лично.",
                      )}
                    </small>
                  </form>
                </>
              )}
            </div>
          )}
          {sheet === "accounts" && (
            <div className="form-stack">
              <p className="muted">
                {tr(
                  "Регистрация закрыта. Создайте локальный аккаунт, затем предоставьте ему доступ на странице нужного автомобиля.",
                )}
              </p>
              {accounts.isLoading && (
                <p role="status">{tr("Загружаем аккаунты…")}</p>
              )}
              {accounts.data?.map((user) => (
                <div className="sharing-member" key={user.id}>
                  <span className="event-icon">
                    <UserRound size={20} />
                  </span>
                  <div>
                    <strong>{user.username}</strong>
                    <small>
                      {user.is_admin
                        ? tr("Администратор установки")
                        : user.disabled
                          ? tr("Отключён")
                          : tr("Локальный аккаунт")}
                    </small>
                  </div>
                  {user.id !== session.id && (
                    <div className="sharing-controls">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setReset(user)}
                      >
                        {tr("Новый пароль")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              tr(
                                "{0} аккаунт {1}? Все его сеансы будут завершены.",
                                [
                                  user.disabled ? "Включить" : "Отключить",
                                  user.username,
                                ],
                              ),
                            )
                          )
                            void change(`/users/${user.id}`, "PATCH", {
                              disabled: !user.disabled,
                            });
                        }}
                      >
                        {user.disabled ? tr("Включить") : tr("Отключить")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {reset ? (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const values = new FormData(e.currentTarget);
                    if (
                      await change(`/users/${reset.id}`, "PATCH", {
                        password: values.get("password"),
                      })
                    ) {
                      setReset(null);
                      notify(tr("Пароль заменён, старые сеансы завершены"));
                    }
                  }}
                >
                  <h3>
                    {tr("Пароль для ")}
                    {reset.username}
                  </h3>
                  <PasswordField />
                  <Button disabled={busy}>{tr("Заменить пароль")}</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setReset(null)}
                  >
                    {tr("Отмена")}
                  </Button>
                </form>
              ) : (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const values = Object.fromEntries(new FormData(form));
                    if (await change("/users", "POST", values)) {
                      form.reset();
                      notify(tr("Аккаунт создан"));
                    }
                  }}
                >
                  <h3>{tr("Новый аккаунт")}</h3>
                  <label>
                    {tr("Имя пользователя")}
                    <input
                      name="username"
                      minLength={3}
                      maxLength={64}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <PasswordField />
                  <Button disabled={busy}>
                    <Plus size={16} />
                    {tr("Создать аккаунт")}
                  </Button>
                </form>
              )}
            </div>
          )}
          {sheet === "password" && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const values = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  if (values.password !== values.confirm)
                    throw new Error(tr("Новые пароли не совпадают"));
                  delete values.confirm;
                  const next = await api<Session>(
                    "/password",
                    { method: "POST", body: JSON.stringify(values) },
                    session.csrf,
                  );
                  updateSession(next);
                  open(null);
                  notify(tr("Пароль изменён. Остальные сеансы завершены."));
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="muted">
                {tr(
                  "Другие устройства выйдут из аккаунта. Текущий гараж останется открыт.",
                )}
              </p>
              <label>
                {tr("Текущий пароль")}
                <input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                />
              </label>
              <PasswordField />
              <label>
                {tr("Повторите новый пароль")}
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  required
                />
              </label>
              <Button disabled={busy}>{tr("Сохранить пароль")}</Button>
            </form>
          )}
        </div>
      </Sheet>
    </>
  );
}
function PasswordField() {
  return (
    <label>
      {tr("Новый пароль")}
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={256}
        required
      />
      <small>
        {tr("Минимум 12 символов. Пароль не сохраняется в журнале действий.")}
      </small>
    </label>
  );
}
