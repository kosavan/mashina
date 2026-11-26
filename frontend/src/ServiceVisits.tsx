import { useState } from "react";
import { Copy, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "./components/ui/button";
import { useApp } from "./context";
import { tr } from "./i18n";
import type { Entry } from "./types";
import { dateLabel, money, today } from "./utils";
import "./service-visits.css";

function visitReport(entry: Entry, vehicle: string, entries: Entry[]) {
  const visit = entry.service_visit;
  const concerns = (visit?.concern_ids ?? []).flatMap((id) => {
    const text =
      visit?.concerns?.find((item) => item.id === id)?.description ??
      entries.find((item) => item.id === id)?.description;
    return text ? [text] : [];
  });
  const sections = [vehicle, dateLabel(entry.occurred_at), entry.vendor || ""];
  if (concerns.length)
    sections.push(
      "",
      tr("С чем приехали"),
      ...concerns.map((text) => `• ${text}`),
    );
  if (entry.description)
    sections.push("", tr("Что сделали"), entry.description);
  if (entry.items.length)
    sections.push(
      "",
      tr("Позиции, запчасти и работы"),
      ...entry.items.map((item) =>
        [`• ${item.name}`, item.part_number, `× ${item.quantity}`]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  sections.push("", tr("Итого"), money(entry.amount_minor, entry.currency));
  if (visit?.follow_up)
    sections.push("", tr("Что проверить после визита"), visit.follow_up);
  return sections.join("\n");
}

const listPageSize = 20;

export default function ServiceVisits() {
  const { state, selected, save, open, notify } = useApp();
  const vehicle = state.vehicles.find((item) => item.id === selected);
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Entry>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState("");
  const [preview, setPreview] = useState("");
  const [concernLimit, setConcernLimit] = useState(listPageSize);
  const [reportLimit, setReportLimit] = useState(listPageSize);
  if (!vehicle) return null;
  const records = state.events.filter(
    (entry) => !entry.deleted && entry.vehicle_id === selected,
  );
  const visits = records
    .filter((entry) => entry.kind === "maintenance")
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const closed = new Set(
    visits.flatMap((entry) => entry.service_visit?.concern_ids ?? []),
  );
  const concerns = records
    .filter(
      (entry) =>
        entry.kind === "note" && entry.service_concern && !closed.has(entry.id),
    )
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const checkedSet = new Set(checked);
  const chosen = concerns.filter(
    (entry) => checkedSet.has(entry.id) && entry.can_edit !== false,
  );
  const report = visits.find((entry) => entry.id === reportId) ?? visits[0];
  const reportText = report && visitReport(report, vehicle.name, records);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setPreview("");
      notify(tr("Скопировано"));
    } catch {
      setPreview(text);
      notify(tr("Выделите текст и скопируйте его вручную."));
    }
  }

  function downloadReport(text: string) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mashina-service-visit.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = draft.trim();
    if (!description) return;
    setError("");
    setBusy(true);
    try {
      await save(
        "event",
        {
          vehicle_id: selected,
          occurred_at: editing?.occurred_at ?? today(),
          kind: "note",
          description,
          service_concern: true,
        },
        editing,
      );
      setEditing(undefined);
      setDraft("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: Entry) {
    if (!confirm(tr("Удалить запись? Действие можно отменить."))) return;
    try {
      const deleted = await save("event", {}, entry, "delete");
      if (editing?.id === entry.id) {
        setEditing(undefined);
        setDraft("");
      }
      notify(tr("Запись удалена"), () => {
        void save("event", {}, deleted, "restore").catch((error) =>
          notify((error as Error).message),
        );
      });
    } catch (error) {
      setError((error as Error).message);
    }
  }

  return (
    <section className="panel service-visits">
      <h2>{tr("Следующий визит на СТО")}</h2>
      <form className="service-visit-entry" onSubmit={submit}>
        <label>
          {tr("Задача для СТО")}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={240}
            placeholder={tr("Например, проверить стук слева")}
            required
          />
        </label>
        <Button disabled={busy || !draft.trim()}>
          <Plus size={16} />
          {editing ? tr("Сохранить") : tr("Добавить задачу")}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setEditing(undefined);
              setDraft("");
            }}
          >
            {tr("Отмена")}
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {concerns.length ? (
        <ul className="service-concerns">
          {concerns.slice(0, concernLimit).map((entry) => (
            <li key={entry.id}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.some((item) => item.id === entry.id)}
                  disabled={
                    entry.can_edit === false ||
                    (!checkedSet.has(entry.id) && chosen.length >= 20)
                  }
                  onChange={(event) => {
                    setChecked(
                      event.target.checked
                        ? [...chosen.map((item) => item.id), entry.id]
                        : checked.filter((id) => id !== entry.id),
                    );
                  }}
                />
                <span>{entry.description}</span>
              </label>
              {entry.can_edit !== false && (
                <div className="service-visit-actions">
                  <button
                    className="icon-button"
                    aria-label={tr("Редактировать {0}", [entry.description])}
                    onClick={() => {
                      setEditing(entry);
                      setDraft(entry.description);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={tr("Удалить {0}", [entry.description])}
                    onClick={() => void remove(entry)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{tr("Нет открытых задач для СТО")}</p>
      )}
      {concerns.length > concernLimit && (
        <Button
          variant="outline"
          onClick={() => setConcernLimit(concernLimit + listPageSize)}
        >
          {tr("Показать ещё")}
        </Button>
      )}
      {concerns.length > 0 && (
        <div className="service-visit-actions">
          <Button
            variant="outline"
            disabled={!chosen.length}
            onClick={() =>
              void copy(
                [
                  vehicle.name,
                  ...chosen.map((entry) => `• ${entry.description}`),
                ].join("\n"),
              )
            }
          >
            <Copy size={16} /> {tr("Скопировать список для СТО")}
          </Button>
          <Button
            disabled={!chosen.length}
            onClick={() =>
              open("maintenance", undefined, {
                serviceVisitDraft: {
                  vehicleId: selected,
                  concernIds: chosen.map((entry) => entry.id),
                },
              })
            }
          >
            {tr("Записать визит и закрыть задачи")}
          </Button>
        </div>
      )}
      {report && reportText && (
        <details>
          <summary>{tr("Отчёт после ремонта")}</summary>
          <label>
            {tr("Выберите запись обслуживания")}
            <select
              value={report.id}
              onChange={(event) => {
                setReportId(event.target.value);
                setPreview("");
              }}
            >
              {visits.slice(0, reportLimit).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {dateLabel(entry.occurred_at)} ·{" "}
                  {entry.vendor ||
                    entry.description ||
                    money(entry.amount_minor, entry.currency)}
                </option>
              ))}
            </select>
          </label>
          {visits.length > reportLimit && (
            <Button
              variant="outline"
              onClick={() => setReportLimit(reportLimit + listPageSize)}
            >
              {tr("Показать ещё")}
            </Button>
          )}
          <p className="service-visit-report">{reportText}</p>
          <div className="service-visit-actions">
            <Button variant="outline" onClick={() => void copy(reportText)}>
              <Copy size={16} /> {tr("Скопировать отчёт")}
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadReport(reportText)}
            >
              <Download size={16} /> {tr("Скачать отчёт")}
            </Button>
          </div>
        </details>
      )}
      {preview && (
        <label>
          {tr("Текст для копирования")}
          <textarea
            readOnly
            value={preview}
            rows={4}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </section>
  );
}
