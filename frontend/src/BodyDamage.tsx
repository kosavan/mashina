import { useEffect, useState } from "react";
import {
  Plus,
  ScanLine,
  ArrowUpRight,
  Pencil,
  Trash2,
  Check,
  CloudOff,
  ImagePlus,
  X,
  MapPin,
  Download,
} from "lucide-react";
import { useApp } from "./context";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { BodyDiagram } from "./BodyDiagram";
import {
  panels,
  panelLabel,
  pointForPanel,
  severityLabels,
  statusLabels,
  typeLabels,
  viewLabels,
  visibleDamages,
} from "./bodyGeometry";
import type {
  BodyDamage as Damage,
  BodyView,
  DamagePhoto,
  RecordBase,
} from "./types";
import { tr, useLocale } from "./i18n";
import { dateLabel, fileURL, money, number, today } from "./utils";
import { pendingMoney } from "./calculations";
import "./body-damage.css";

interface Placement {
  view: BodyView;
  panel: string;
  x: number;
  y: number;
}
function ViewPicker({
  value,
  onChange,
}: {
  value: BodyView;
  onChange: (view: BodyView) => void;
}) {
  return (
    <div
      className="body-view-picker"
      role="group"
      aria-label={tr("Вид кузова")}
    >
      {(Object.keys(viewLabels) as BodyView[]).map((view) => (
        <button
          type="button"
          key={view}
          aria-pressed={value === view}
          onClick={() => onChange(view)}
        >
          {tr(viewLabels[view])}
        </button>
      ))}
    </div>
  );
}
function Status({ record }: { record: Damage }) {
  return (
    <span className={`body-status body-status-${record.status}`}>
      <span aria-hidden="true" />
      {tr(statusLabels[record.status])}
      {record.pending && (
        <CloudOff size={12} aria-label={tr("Ожидает синхронизации")} />
      )}
    </span>
  );
}

export default function BodyDamage({ vehicleId }: { vehicleId: string }) {
  useLocale();
  const { state, save, notify, open } = useApp();
  const [view, setView] = useState<BodyView>("left");
  const [filter, setFilter] = useState("unresolved");
  const [limit, setLimit] = useState(6);
  const [details, setDetails] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    record?: Damage;
    placement: Placement;
  } | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const car = state.vehicles.find((v) => v.id === vehicleId);
  const all = (state.body_damages || []).filter(
    (r) => r.vehicle_id === vehicleId && !r.deleted,
  );
  const rows = visibleDamages(state.body_damages || [], vehicleId, filter);
  const record = all.find((r) => r.id === details);
  if (!car) return null;
  const canEdit = car.can_edit !== false;
  function add(placement?: Placement) {
    const shape = panels[view][0];
    setEditor({
      placement: placement || {
        view,
        panel: shape.id,
        ...pointForPanel(shape),
      },
    });
  }
  async function remove(item: Damage) {
    setDeleting(true);
    setError("");
    try {
      const deleted = await save("body_damage", {}, item, "delete");
      setDetails(null);
      notify(tr("Повреждение удалено"), async () => {
        try {
          await save("body_damage", {}, deleted, "restore");
          notify(tr("Повреждение восстановлено"));
        } catch (error) {
          setError((error as Error).message);
        }
      });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  const service =
    record &&
    state.events.find(
      (e) =>
        e.id === record.maintenance_event_id &&
        !e.deleted &&
        e.kind === "maintenance",
    );
  return (
    <section className="body-section" aria-labelledby="body-heading">
      <div className="section-heading body-heading">
        <div>
          <span className="eyebrow">{tr("СОСТОЯНИЕ КУЗОВА")}</span>
          <h3 id="body-heading">{tr("Кузов и повреждения")}</h3>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => add()}>
            <Plus size={16} />
            {tr("Отметить повреждение")}
          </Button>
        )}
      </div>
      {error && (
        <p className="body-error" role="alert">
          {tr(error)}
        </p>
      )}
      <div className="body-workspace">
        <div className="panel body-map-panel">
          <div className="body-map-title">
            <ScanLine size={20} />
            <div>
              <strong>{tr("Каждая деталь — часть истории")}</strong>
              <p>{tr("Универсальная схема · оценка владельца")}</p>
            </div>
          </div>
          <ViewPicker value={view} onChange={setView} />
          <BodyDiagram
            view={view}
            records={rows}
            activeId={details || undefined}
            onRecord={(item) => setDetails(item.id)}
            onPanel={
              canEdit
                ? (shape, point) => add({ view, panel: shape.id, ...point })
                : undefined
            }
          />
          <p className="body-map-help">
            <MapPin size={14} />
            {canEdit
              ? tr(
                  "Нажмите на деталь, чтобы поставить отметку. Список доступен рядом со схемой.",
                )
              : tr("Выберите отметку или откройте повреждение в списке.")}
          </p>
          <div className="body-summary">
            <span>
              <b>{all.filter((r) => r.status !== "repaired").length}</b>
              {tr("Нерешённые")}
            </span>
            <span>
              <b>{all.filter((r) => r.status === "repaired").length}</b>
              {tr("Устранённые")}
            </span>
            <span>
              <b>{all.length}</b>
              {tr("Вся история")}
            </span>
          </div>
        </div>
        <div className="body-list-panel">
          <label className="body-filter">
            {tr("Показать повреждения")}
            <select
              aria-label={tr("Показать повреждения")}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(6);
              }}
            >
              <option value="unresolved">{tr("Только нерешённые")}</option>
              <option value="all">{tr("Все повреждения")}</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {tr(label)}
                </option>
              ))}
            </select>
          </label>
          {rows.length ? (
            <>
              <div className="body-issue-list">
                {rows.slice(0, limit).map((item) => (
                  <button
                    className="panel body-issue"
                    key={item.id}
                    onClick={() => {
                      setView(item.view);
                      setDetails(item.id);
                    }}
                  >
                    <div className="body-issue-top">
                      <Status record={item} />
                      <ArrowUpRight size={17} />
                    </div>
                    <strong>{item.title}</strong>
                    <p>
                      {tr(viewLabels[item.view])} · {tr(panelLabel(item))}
                    </p>
                    <div className="body-issue-meta">
                      <span>{dateLabel(item.discovered_on)}</span>
                      <span>
                        {tr(typeLabels[item.damage_type])} ·{" "}
                        {tr(severityLabels[item.severity])}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {rows.length > limit && (
                <Button variant="outline" onClick={() => setLimit(limit + 6)}>
                  {tr("Показать ещё")}
                </Button>
              )}
            </>
          ) : (
            <div className="panel body-empty">
              <Check size={28} />
              <h4>
                {all.length
                  ? tr("В этом фильтре повреждений нет")
                  : tr("Сохраним историю кузова")}
              </h4>
              <p>
                {all.length
                  ? tr(
                      "Выберите другой статус, чтобы увидеть остальные отметки.",
                    )
                  : tr(
                      "Царапины, сколы и ремонт — с точным местом, фотографиями и историей.",
                    )}
              </p>
              {canEdit && (
                <Button variant="outline" onClick={() => add()}>
                  {tr("Добавить первую отметку")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {record && (
        <Sheet open onClose={() => setDetails(null)} title={record.title} wide>
          <div className="body-detail">
            <div className="body-detail-meta">
              <Status record={record} />
              <span>
                {tr(viewLabels[record.view])} · {tr(panelLabel(record))}
              </span>
            </div>
            <BodyDiagram view={record.view} point={record} />
            <dl className="body-facts">
              <div>
                <dt>{tr("Обнаружено")}</dt>
                <dd>{dateLabel(record.discovered_on)}</dd>
              </div>
              <div>
                <dt>{tr("Повреждение")}</dt>
                <dd>
                  {tr(typeLabels[record.damage_type])} ·{" "}
                  {tr(severityLabels[record.severity])}
                </dd>
              </div>
              {record.odometer != null && (
                <div>
                  <dt>{tr("Пробег при обнаружении")}</dt>
                  <dd>
                    {number(record.odometer)} {tr("км")}
                  </dd>
                </div>
              )}
              {record.estimate_minor != null && (
                <div>
                  <dt>{tr("Оценка ремонта")}</dt>
                  <dd>
                    {money(record.estimate_minor, record.currency)}
                    <small>{tr("Не входит в фактические расходы")}</small>
                  </dd>
                </div>
              )}
              {record.repaired_on && (
                <div>
                  <dt>{tr("Дата ремонта")}</dt>
                  <dd>{dateLabel(record.repaired_on)}</dd>
                </div>
              )}
            </dl>
            {record.notes && <p className="body-notes">{record.notes}</p>}
            {record.maintenance_event_id && (
              <div className="body-linked">
                <strong>{tr("Связанный ремонт")}</strong>
                {service ? (
                  <>
                    <p>
                      {service.description || tr("Обслуживание")} ·{" "}
                      {dateLabel(service.occurred_at)} ·{" "}
                      {money(service.amount_minor, service.currency)}
                    </p>
                    {service.can_edit !== false && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetails(null);
                          open("maintenance", service);
                        }}
                      >
                        {tr("Открыть запись ремонта")}
                        <ArrowUpRight size={15} />
                      </Button>
                    )}
                  </>
                ) : (
                  <p>
                    {tr(
                      "Запись ремонта удалена или недоступна. История повреждения сохранена.",
                    )}
                  </p>
                )}
              </div>
            )}
            {record.photos.length > 0 && (
              <>
                <h4>{tr("Фотографии до и после")}</h4>
                <div className="body-photo-grid">
                  {record.photos.map((photo) => {
                    const attachment = state.attachments.find(
                      (a) => a.id === photo.attachment_id,
                    );
                    return (
                      <figure key={photo.attachment_id}>
                        {attachment ? (
                          <>
                            <img
                              src={fileURL(attachment.id)}
                              alt={attachment.title || record.title}
                              loading="lazy"
                            />
                            <figcaption>
                              {photo.phase === "before"
                                ? tr("До ремонта")
                                : tr("После ремонта")}
                              <a
                                href={`${fileURL(attachment.id)}?download=true`}
                                aria-label={tr("Скачать фото")}
                              >
                                <Download size={16} />
                              </a>
                            </figcaption>
                          </>
                        ) : (
                          <figcaption className="body-unavailable">
                            <CloudOff size={22} />
                            {tr("Фото удалено или доступно только владельцу")}
                          </figcaption>
                        )}
                      </figure>
                    );
                  })}
                </div>
              </>
            )}
            <h4>{tr("История статусов")}</h4>
            {record.pending && (
              <p className="body-pending">
                <CloudOff size={15} />
                {tr(
                  "Текущий статус ожидает синхронизации. История обновится после сохранения на сервере.",
                )}
              </p>
            )}
            <ol className="body-status-history">
              {record.status_history?.map((step, index) => (
                <li key={index}>
                  <span
                    className={`body-history-dot body-status-${step.status}`}
                  />
                  <div>
                    <strong>{tr(statusLabels[step.status])}</strong>
                    <time dateTime={step.changed_at}>
                      {dateLabel(step.changed_at)}
                    </time>
                    {step.repaired_on && (
                      <small>
                        {tr("Дата ремонта")}: {dateLabel(step.repaired_on)}
                      </small>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {canEdit && (
              <div className="body-actions">
                <Button
                  onClick={() => {
                    setEditor({ record, placement: record });
                    setDetails(null);
                  }}
                >
                  <Pencil size={16} />
                  {tr("Редактировать")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => remove(record)}
                >
                  <Trash2 size={16} />
                  {tr("Удалить")}
                </Button>
              </div>
            )}
          </div>
        </Sheet>
      )}
      {editor && (
        <DamageEditor
          vehicleId={vehicleId}
          original={editor.record}
          placement={editor.placement}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}

function DamageEditor({
  vehicleId,
  original,
  placement,
  onClose,
}: {
  vehicleId: string;
  original?: Damage;
  placement: Placement;
  onClose: () => void;
}) {
  const { state, save, upload, notify } = useApp();
  const car = state.vehicles.find((v) => v.id === vehicleId)!;
  const [draft, setDraft] = useState({
    ...placement,
    title: original?.title || "",
    damage_type: original?.damage_type || "scratch",
    severity: original?.severity || "minor",
    status: original?.status || "observed",
    discovered_on: original?.discovered_on || today(),
    repaired_on: original?.repaired_on || "",
    odometer: original?.odometer == null ? "" : String(original.odometer),
    notes: original?.notes || "",
    estimate:
      original?.estimate_minor == null
        ? ""
        : (original.estimate_minor / 100).toFixed(2),
    maintenance_event_id: original?.maintenance_event_id || "",
    photos: original?.photos || ([] as DamagePhoto[]),
  });
  const [phase, setPhase] = useState<DamagePhoto["phase"]>("before");
  const [reuse, setReuse] = useState("");
  const [files, setFiles] = useState<
    { id: string; file: File; phase: DamagePhoto["phase"] }[]
  >([]);
  const [persisted, setPersisted] = useState<RecordBase | undefined>(original);
  const [online, setOnline] = useState(navigator.onLine);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    const leaving = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [dirty]);
  const pictures = state.attachments.filter(
    (a) =>
      a.vehicle_id === vehicleId &&
      a.media_type.startsWith("image/") &&
      !draft.photos.some((p) => p.attachment_id === a.id),
  );
  const services = state.events.filter(
    (e) => e.vehicle_id === vehicleId && !e.deleted && e.kind === "maintenance",
  );
  function close() {
    if (busy) return;
    if (
      !dirty ||
      confirm(
        tr(
          "Закрыть без сохранения? Изменения повреждения и выбранные фото будут потеряны.",
        ),
      )
    )
      onClose();
  }
  function change(name: string, value: string) {
    setDraft((d) => ({ ...d, [name]: value }));
    setDirty(true);
  }
  function changeView(view: BodyView) {
    const shape = panels[view][0];
    setDraft((d) => ({ ...d, view, panel: shape.id, ...pointForPanel(shape) }));
    setDirty(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    let stored = persisted;
    let savedThisAttempt = false;
    try {
      // Match exact server money validation before committing an offline draft.
      if (draft.estimate !== "") pendingMoney({ amount: draft.estimate });
      stored = await save(
        "body_damage",
        { ...draft, vehicle_id: vehicleId, currency: car.currency || "RUB" },
        stored,
      );
      setPersisted(stored);
      savedThisAttempt = true;
      let photos = [...draft.photos];
      for (const selected of files) {
        const image = await upload(selected.file, {
          vehicle_id: vehicleId,
          title: draft.title,
          document_type: tr("Фото кузова"),
        });
        photos = [
          ...photos,
          { attachment_id: image.id, phase: selected.phase },
        ];
        setDraft((d) => ({ ...d, photos }));
        setFiles((rest) => rest.filter((f) => f.id !== selected.id));
        stored = await save("body_damage", { photos }, stored);
        setPersisted(stored);
      }
      setDirty(false);
      notify(tr("Повреждение сохранено"));
      onClose();
    } catch (error) {
      setError(
        (savedThisAttempt
          ? tr(
              "Запись уже сохранена. Незагруженные фото остаются в открытом редакторе; повторите сохранение после подключения.",
            ) + " "
          : "") + tr((error as Error).message),
      );
      setDirty(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={close}
      title={original ? tr("Изменить повреждение") : tr("Новое повреждение")}
      wide
    >
      <form
        className="body-editor"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        {error && (
          <p className="body-error" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="body-editor-fields">
          <label>
            {tr("Название повреждения")}
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.title}
              onChange={(e) => change("title", e.target.value)}
              placeholder={tr("Например, царапина на двери")}
            />
          </label>
          <details className="body-location-editor">
            <summary>
              {tr("Место на схеме")}: {tr(viewLabels[draft.view])} ·{" "}
              {tr(panelLabel(draft))}
            </summary>
            <ViewPicker value={draft.view} onChange={changeView} />
            <BodyDiagram
              view={draft.view}
              selectedPanel={draft.panel}
              point={draft}
              onPanel={(shape, point) => {
                setDraft((d) => ({ ...d, panel: shape.id, ...point }));
                setDirty(true);
              }}
            />
            <label>
              {tr("Деталь кузова")}
              <select
                aria-label={tr("Деталь кузова")}
                value={draft.panel}
                onChange={(e) => {
                  const shape = panels[draft.view].find(
                    (p) => p.id === e.target.value,
                  )!;
                  setDraft((d) => ({
                    ...d,
                    panel: shape.id,
                    ...pointForPanel(shape),
                  }));
                  setDirty(true);
                }}
              >
                {panels[draft.view].map((p) => (
                  <option key={p.id} value={p.id}>
                    {tr(p.label)}
                  </option>
                ))}
              </select>
            </label>
          </details>
          <div className="body-form-grid">
            <label>
              {tr("Тип повреждения")}
              <select
                aria-label={tr("Тип повреждения")}
                value={draft.damage_type}
                onChange={(e) => change("damage_type", e.target.value)}
              >
                {Object.entries(typeLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Серьёзность по вашей оценке")}
              <select
                aria-label={tr("Серьёзность по вашей оценке")}
                value={draft.severity}
                onChange={(e) => change("severity", e.target.value)}
              >
                {Object.entries(severityLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Статус повреждения")}
              <select
                aria-label={tr("Статус повреждения")}
                value={draft.status}
                onChange={(e) => change("status", e.target.value)}
              >
                {Object.entries(statusLabels).map(([id, label]) => (
                  <option value={id} key={id}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Дата обнаружения")}
              <input
                type="date"
                required
                max={today()}
                value={draft.discovered_on}
                onChange={(e) => change("discovered_on", e.target.value)}
              />
            </label>
          </div>
          <label>
            {tr("Описание повреждения")}
            <textarea
              rows={3}
              maxLength={4000}
              value={draft.notes}
              onChange={(e) => change("notes", e.target.value)}
            />
          </label>
          <details className="body-advanced">
            <summary>{tr("Ремонт и дополнительные сведения")}</summary>
            <div className="body-form-grid">
              <label>
                {tr("Пробег при обнаружении")}
                <input
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="3000000"
                  step="1"
                  value={draft.odometer}
                  onChange={(e) => change("odometer", e.target.value)}
                />
              </label>
              <label>
                {tr("Оценка ремонта")} · {car.currency || "RUB"}
                <input
                  inputMode="decimal"
                  value={draft.estimate}
                  onChange={(e) => change("estimate", e.target.value)}
                />
                <small>{tr("Не входит в фактические расходы")}</small>
              </label>
              <label>
                {tr("Дата ремонта")}
                <input
                  type="date"
                  min={draft.discovered_on}
                  max={today()}
                  value={draft.repaired_on}
                  onChange={(e) => change("repaired_on", e.target.value)}
                />
              </label>
              <label>
                {tr("Связать с обслуживанием")}
                <select
                  aria-label={tr("Связать с обслуживанием")}
                  value={draft.maintenance_event_id}
                  onChange={(e) =>
                    change("maintenance_event_id", e.target.value)
                  }
                >
                  <option value="">{tr("Без привязки")}</option>
                  {draft.maintenance_event_id &&
                    !services.some(
                      (e) => e.id === draft.maintenance_event_id,
                    ) && (
                      <option value={draft.maintenance_event_id}>
                        {tr("Прежняя запись недоступна")}
                      </option>
                    )}
                  {services.map((e) => (
                    <option key={e.id} value={e.id}>
                      {dateLabel(e.occurred_at)} ·{" "}
                      {e.description || tr("Обслуживание")} ·{" "}
                      {money(e.amount_minor, e.currency)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="tiny muted">
              {tr(
                "Пробег здесь справочный. Связь с ремонтом не создаёт новый расход.",
              )}
            </p>
          </details>
          <div className="body-evidence-editor">
            <h4>{tr("Фотографии до и после")}</h4>
            <p className="tiny muted">
              {tr(
                "Фото загружаются при сохранении и остаются в документах после удаления отметки.",
              )}
            </p>
            <label>
              {tr("Этап фотографии")}
              <select
                aria-label={tr("Этап фотографии")}
                value={phase}
                onChange={(e) =>
                  setPhase(e.target.value as DamagePhoto["phase"])
                }
              >
                <option value="before">{tr("До ремонта")}</option>
                <option value="after">{tr("После ремонта")}</option>
              </select>
            </label>
            <label className={`body-upload ${!online ? "disabled" : ""}`}>
              <ImagePlus size={22} />
              {tr("Выбрать фото повреждения")}
              <input
                aria-label={tr("Выбрать фото повреждения")}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={
                  !online || busy || draft.photos.length + files.length >= 20
                }
                onChange={(e) => {
                  const chosen = Array.from(e.target.files || []);
                  if (draft.photos.length + files.length + chosen.length > 20) {
                    setError(tr("Не более 20 фотографий повреждения"));
                    e.target.value = "";
                    return;
                  }
                  setFiles((rest) => [
                    ...rest,
                    ...chosen.map((file) => ({
                      id: crypto.randomUUID(),
                      file,
                      phase,
                    })),
                  ]);
                  setDirty(true);
                  e.target.value = "";
                }}
              />
            </label>
            {!online && (
              <p className="body-pending">
                <CloudOff size={15} />
                {tr(
                  "Отметка и текст сохраняются офлайн. Для новых фото подключитесь к серверу; выбранные файлы не хранятся в офлайн-очереди.",
                )}
              </p>
            )}
            {pictures.length > 0 && (
              <div className="body-reuse">
                <label>
                  {tr("Фото из документов автомобиля")}
                  <select
                    aria-label={tr("Фото из документов автомобиля")}
                    value={reuse}
                    onChange={(e) => setReuse(e.target.value)}
                  >
                    <option value="">{tr("Выберите фотографию")}</option>
                    {pictures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.original_name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!reuse || draft.photos.length + files.length >= 20}
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      photos: [...d.photos, { attachment_id: reuse, phase }],
                    }));
                    setReuse("");
                    setDirty(true);
                  }}
                >
                  {tr("Прикрепить")}
                </Button>
              </div>
            )}
            <ul className="body-file-list">
              {draft.photos.map((p) => (
                <li key={p.attachment_id}>
                  <span>
                    {state.attachments.find((a) => a.id === p.attachment_id)
                      ?.title || tr("Недоступное фото")}
                    <small>
                      {p.phase === "before"
                        ? tr("До ремонта")
                        : tr("После ремонта")}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tr("Убрать фото из повреждения")}
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        photos: d.photos.filter(
                          (f) => f.attachment_id !== p.attachment_id,
                        ),
                      }));
                      setDirty(true);
                    }}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
              {files.map((f) => (
                <li key={f.id}>
                  <span>
                    {f.file.name}
                    <small>
                      {f.phase === "before"
                        ? tr("До ремонта")
                        : tr("После ремонта")}{" "}
                      · {tr("Ожидает загрузки")}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tr("Убрать выбранный файл")}
                    onClick={() =>
                      setFiles((rest) => rest.filter((p) => p.id !== f.id))
                    }
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </fieldset>
        <div className="body-actions">
          <Button type="submit" disabled={busy}>
            {busy ? tr("Сохраняем…") : tr("Сохранить повреждение")}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>
            {tr("Отмена")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
