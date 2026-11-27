import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import { api } from "./api";
import { Button } from "./components/ui/button";
import { useApp } from "./context";
import { intlLocale, tr } from "./i18n";
import "./backup-schedule.css";

interface BackupSchedule {
  enabled: boolean;
  directory: string;
  hour_utc: number;
  keep: number;
}

interface BackupRun {
  finished_at: string;
  verified: boolean;
}

interface BackupStatus {
  schedule: BackupSchedule;
  last_run: BackupRun | null;
  last_verified?: BackupRun | null;
}

export function BackupScheduleSettings() {
  const { session, notify } = useApp();
  const [status, setStatus] = useState<BackupStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = "/admin/backup-schedule";

  useEffect(() => {
    const controller = new AbortController();
    api<BackupStatus>(endpoint, { signal: controller.signal })
      .then(setStatus)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const schedule: BackupSchedule = {
      enabled: fields.has("enabled"),
      directory: String(fields.get("directory") ?? ""),
      hour_utc: Number(fields.get("hour_utc")),
      keep: Number(fields.get("keep")),
    };
    setBusy(true);
    setError("");
    try {
      setStatus(
        await api<BackupStatus>(
          endpoint,
          {
            method: "PUT",
            body: JSON.stringify(schedule),
          },
          session.csrf,
        ),
      );
      notify(tr("Расписание резервных копий сохранено"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const format = (timestamp: string) =>
    new Date(timestamp).toLocaleString(intlLocale());

  return (
    <section className="backup-schedule">
      <h4>{tr("Резервные копии по расписанию")}</h4>
      {error && <p role="alert">{tr(error)}</p>}
      {!status && !error && <p>{tr("Загрузка…")}</p>}
      {status && (
        <form className="record-form backup-schedule-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="backup-status">
              <label className="backup-toggle">
                <span>{tr("Создавать копию ежедневно")}</span>
                <input
                  type="checkbox"
                  role="switch"
                  name="enabled"
                  defaultChecked={status.schedule.enabled}
                />
                <span className="backup-toggle-track" aria-hidden="true" />
              </label>
              <p className="backup-status-line" role="status">
                {status.last_verified ? (
                  <CircleCheck size={16} aria-hidden="true" />
                ) : (
                  <Clock3 size={16} aria-hidden="true" />
                )}
                {status.last_verified
                  ? tr("Последняя проверенная копия: {0}", [
                      format(status.last_verified.finished_at),
                    ])
                  : tr("Проверенных автоматических копий пока нет")}
              </p>
              {status.last_run && !status.last_run.verified && (
                <p
                  className="backup-status-line backup-status-failed"
                  role="status"
                >
                  <CircleAlert size={16} aria-hidden="true" />
                  {tr("Последняя автоматическая копия не прошла проверку")}
                </p>
              )}
            </div>
            <div className="backup-schedule-fields">
              <label>
                {tr("Час запуска (UTC)")}
                <input
                  name="hour_utc"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={status.schedule.hour_utc}
                  required
                />
              </label>
              <label>
                {tr("Количество сохраняемых копий")}
                <input
                  name="keep"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={status.schedule.keep}
                  required
                />
              </label>
              <label className="backup-schedule-folder">
                {tr("Папка внутри каталога резервных копий")}
                <input
                  name="directory"
                  defaultValue={status.schedule.directory}
                  pattern="[a-zA-Z0-9_\x2D]{1,64}"
                  required
                />
              </label>
            </div>
            <Button type="submit" variant="outline">
              {tr(busy ? "Сохраняем…" : "Сохранить")}
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
