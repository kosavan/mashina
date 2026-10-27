import { intlLocale } from "./i18n";
import { categoryLabel } from "./utils";
import { LanguagePicker } from "./LanguagePicker";
import { getLocale } from "./i18n";
import { tr } from "./i18n";
import { useState, lazy, Suspense } from "react";
const BodyDamage = lazy(() => import("./BodyDamage"));
const OwnershipTools = lazy(() => import("./OwnershipTools"));
const Sharing = lazy(() => import("./Sharing"));
const SaleReport = lazy(() => import("./SaleReport"));
const Notifications = lazy(() => import("./Notifications"));
const MachineAccess = lazy(() => import("./MachineAccess"));
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  CarFront,
  Fuel,
  Wrench,
  Clock3,
  Bell,
  FileText,
  Search,
  MoreHorizontal,
  ChevronRight,
  Download,
  ShieldCheck,
  HardDrive,
  Upload,
  LogOut,
  Archive,
  RotateCcw,
  Check,
  CalendarDays,
  Gauge,
  Trash2,
  Pencil,
  ChevronLeft,
  FolderOpen,
} from "lucide-react";
import { useApp } from "./context";
import type { Attachment, Entry, Reminder } from "./types";
import { api } from "./offline";
import {
  activeEvents,
  categories,
  dateLabel,
  download,
  fileURL,
  kindNames,
  money,
  monthStart,
  number,
  sumEvents,
  today,
  vehicleImage,
} from "./utils";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { ServiceLocation } from "./ServiceLocation";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{tr(eyebrow)}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  description,
  onClick,
  label = tr("Добавить запись"),
  icon: Icon = CarFront,
}: {
  title: string;
  description: string;
  onClick?: () => void;
  label?: string;
  icon?: typeof CarFront;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={31} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onClick && (
        <Button onClick={onClick}>
          <Plus size={17} />
          {tr(label)}
        </Button>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  unit,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  icon?: typeof CarFront;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {tr(label)}
        {Icon && <Icon size={17} />}
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function VehicleSelect({
  all = false,
  value,
  onChange,
}: {
  all?: boolean;
  value?: string;
  onChange?: (id: string) => void;
}) {
  const { state, selected, setSelected } = useApp();
  return (
    <label className="filter-select">
      <CarFront size={17} />
      <select
        aria-label={tr("Автомобиль")}
        value={value ?? selected}
        onChange={(e) => (onChange || setSelected)(e.target.value)}
      >
        {all && <option value="">{tr("Все автомобили")}</option>}
        {state.vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Garage() {
  const { state, open, setPage, setSelected, selected } = useApp();
  const [tab, setTab] = useState("active");
  const entries = activeEvents(state);
  const month = entries.filter(
    (e) => e.occurred_at.slice(0, 10) >= monthStart(),
  );
  const cars = state.vehicles.filter((v) =>
    tab === "active" ? v.status === "active" : v.status !== "active",
  );
  const reminders = state.reminders.filter(
    (r) =>
      r.enabled &&
      !r.deleted &&
      !r.completed_at &&
      (r.status === "soon" || r.status === "overdue"),
  );
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      name: new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(d),
      value: sumEvents(entries.filter((e) => e.occurred_at.startsWith(key))),
    };
  });
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <>
      <PageHeading
        eyebrow={tr("ВАШИ АВТОМОБИЛИ. ВАША ИСТОРИЯ.")}
        title={tr("Мой гараж")}
        description={tr("Всё важное о ваших автомобилях — в одном месте.")}
        action={
          <Button variant="outline" onClick={() => open("vehicle")}>
            <Plus size={17} />
            {tr("Добавить автомобиль")}
          </Button>
        }
      />
      <section className="garage-summary">
        <div>
          <span className="summary-icon">
            <CarFront size={22} />
          </span>
          <div>
            <small>{tr("Автомобилей в гараже")}</small>
            <strong>
              {state.vehicles.filter((v) => v.status === "active").length}
              <span>{tr("авто")}</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <ArrowUpRight size={22} />
          </span>
          <div>
            <small>{tr("Расходы в этом месяце")}</small>
            <strong>{money(sumEvents(month))}</strong>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <Gauge size={22} />
          </span>
          <div>
            <small>{tr("Пробег за время владения")}</small>
            <strong>
              {number(
                state.vehicles.reduce(
                  (s, v) =>
                    s + Math.max(0, v.current_odometer - v.purchase_odometer),
                  0,
                ),
              )}
              <span>{tr("км")}</span>
            </strong>
          </div>
        </div>
        <div>
          <span className={`summary-icon ${reminders.length ? "lime" : ""}`}>
            <Bell size={21} />
          </span>
          <div>
            <small>{tr("Требует внимания")}</small>
            <strong>
              {reminders.length}
              <span>
                {reminders.length ? tr("напоминания") : tr("всё спокойно")}
              </span>
            </strong>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div className="tabs">
          <button
            className={tab === "active" ? "active" : ""}
            onClick={() => setTab("active")}
          >
            {tr("В гараже")}{" "}
            <span>
              {state.vehicles.filter((v) => v.status === "active").length}
            </span>
          </button>
          <button
            className={tab === "archive" ? "active" : ""}
            onClick={() => setTab("archive")}
          >
            {tr("Архив")}{" "}
            <span>
              {state.vehicles.filter((v) => v.status !== "active").length}
            </span>
          </button>
        </div>
        <span className="tiny muted">
          {tr("У каждого автомобиля своя история")}
        </span>
      </div>
      <section className="vehicle-grid">
        {cars.map((v) => {
          const events = activeEvents(state, v.id);
          const next = state.reminders
            .filter(
              (r) =>
                r.vehicle_id === v.id &&
                r.enabled &&
                !r.completed_at &&
                !r.deleted,
            )
            .sort(
              (a, b) =>
                (a.remaining_days ?? 99999) - (b.remaining_days ?? 99999),
            )[0];
          const image = vehicleImage(v, true);
          return (
            <article className="vehicle-card" key={v.id}>
              <button
                className="vehicle-open"
                aria-label={tr("Открыть {0}", [v.name])}
                onClick={() => {
                  setSelected(v.id);
                  setPage("vehicle");
                }}
              >
                <div
                  className={`vehicle-cover ${v.demo_image?.includes("porsche") ? "warm" : ""}`}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={v.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="vehicle-placeholder">
                      <CarFront size={80} strokeWidth={1} />
                      <span>{tr("Добавьте любимый ракурс")}</span>
                    </div>
                  )}
                  <span className="vehicle-badge">
                    {v.status === "active"
                      ? tr("В ГАРАЖЕ")
                      : v.status === "sold"
                        ? tr("ПРОДАН")
                        : tr("В АРХИВЕ")}
                  </span>
                  <span className="cover-arrow">
                    <ArrowUpRight size={20} />
                  </span>
                  <div className="cover-caption">
                    {v.demo_image
                      ? "MASHINA / DEMO COLLECTION"
                      : v.brand || tr("ВАШ АВТОМОБИЛЬ")}
                  </div>
                </div>
                <div className="vehicle-content">
                  <div className="vehicle-title">
                    <h2>{v.name}</h2>
                    <span>{v.year || "—"}</span>
                  </div>
                  <div className="vehicle-subtitle">
                    <span className="license-plate">
                      {v.plate || tr("Без номера")}
                    </span>
                    <span>
                      {v.engine || v.fuel || tr("Персональный автомобиль")}
                    </span>
                  </div>
                  <div className="vehicle-numbers">
                    <div>
                      <small>{tr("Пробег")}</small>
                      <strong>
                        {number(v.current_odometer)}
                        <span>{tr("км")}</span>
                      </strong>
                    </div>
                    <div>
                      <small>{tr("В этом месяце")}</small>
                      <strong>
                        {money(
                          sumEvents(
                            events.filter(
                              (e) => e.occurred_at.slice(0, 10) >= monthStart(),
                            ),
                          ),
                        )}
                      </strong>
                    </div>
                  </div>
                  <div
                    className={`vehicle-next ${next?.status === "overdue" ? "danger" : ""}`}
                  >
                    <span className="status-dot" />
                    <span>
                      {next ? next.title : tr("Всё под контролем")}
                      {v.role === "driver" && <em> {tr(" · Водитель")}</em>}
                    </span>
                    <small>
                      {next
                        ? next.remaining_km != null
                          ? tr("{0} км", [number(next.remaining_km)])
                          : next.due_date
                            ? dateLabel(next.due_date)
                            : tr("Запланировано")
                        : tr("Нет ближайших работ")}
                    </small>
                  </div>
                </div>
              </button>
              {v.can_edit !== false && (
                <button
                  className="vehicle-more icon-button"
                  aria-label={tr("Редактировать {0}", [v.name])}
                  onClick={() => open("vehicle", v)}
                >
                  <MoreHorizontal size={20} />
                </button>
              )}
            </article>
          );
        })}
        {cars.length === 0 && (
          <div className="panel full-grid">
            <Empty
              title={
                tab === "active"
                  ? tr("Здесь начинается ваша история")
                  : tr("В архиве пока пусто")
              }
              description={
                tab === "active"
                  ? tr(
                      "Добавьте первый автомобиль. Все расходы, поездки и важные детали найдут своё место.",
                    )
                  : tr("Проданные и архивные автомобили сохранят свою историю.")
              }
              onClick={tab === "active" ? () => open("vehicle") : undefined}
              label={tr("Добавить автомобиль")}
            />
          </div>
        )}
      </section>
      <section className="dashboard-bottom">
        <div className="panel spending-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{tr("ПОД КОНТРОЛЕМ")}</span>
              <h3>{tr("Как меняются расходы")}</h3>
            </div>
            <button className="text-link" onClick={() => setPage("analytics")}>
              {tr("Аналитика")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="spending-total">
            {money(sumEvents(month))}
            <span>{tr("в этом месяце · RUB")}</span>
          </div>
          {entries.length ? (
            <div className="mini-chart">
              {months.map((m, i) => (
                <div key={i}>
                  <span className="chart-tooltip">{money(m.value)}</span>
                  <div
                    style={{ height: `${Math.max(3, (m.value / max) * 100)}%` }}
                    className={i === 5 ? "highlight" : ""}
                  />
                  <small>{m.name}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="chart-empty muted">
              {tr("Добавьте первый расход, и здесь появится ваша динамика.")}
            </p>
          )}
        </div>
        <div className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{tr("НЕ УПУСТИТЬ ВАЖНОЕ")}</span>
              <h3>{tr("На горизонте")}</h3>
            </div>
            <Bell size={20} />
          </div>
          {reminders.length ? (
            reminders.slice(0, 3).map((r) => (
              <button
                className="attention-row"
                key={r.id}
                onClick={() => {
                  setSelected(r.vehicle_id);
                  setPage("reminders");
                }}
              >
                <span
                  className={`event-icon ${r.status === "overdue" ? "overdue" : "maintenance"}`}
                >
                  <Wrench size={18} />
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {state.vehicles.find((v) => v.id === r.vehicle_id)?.name} ·{" "}
                    {r.remaining_km != null
                      ? tr("{0} км", [number(r.remaining_km)])
                      : dateLabel(r.due_date)}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <div className="calm-state">
              <ShieldCheck size={32} />
              <p>{tr("Можно просто наслаждаться дорогой.")}</p>
              <button
                hidden={!state.vehicles.some((v) => v.can_edit !== false)}
                className="text-link"
                onClick={() => open("reminder")}
              >
                {tr("Создать напоминание")}
                <Plus size={14} />
              </button>
            </div>
          )}
          <button
            className="panel-bottom-link"
            onClick={() => setPage("reminders")}
          >
            {tr("Все напоминания")}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{tr("ИСТОРИЯ ПРОДОЛЖАЕТСЯ")}</span>
            <h3>{tr("Последние события")}</h3>
          </div>
          <button className="text-link" onClick={() => setPage("timeline")}>
            {tr("Вся история")}
            <ArrowUpRight size={16} />
          </button>
        </div>
        {entries.length ? (
          entries
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .slice(0, 4)
            .map((e) => <EventRow key={e.id} entry={e} />)
        ) : (
          <Empty
            icon={Clock3}
            title={tr("Ни одна деталь не потеряется")}
            description={tr(
              "Запишите первую заправку, обслуживание или просто важный момент.",
            )}
            onClick={() => {
              if (!selected) open("vehicle");
              else open("quick");
            }}
          />
        )}
      </section>
    </>
  );
}

export function EventRow({ entry }: { entry: Entry }) {
  const { state, open, save, notify, refresh } = useApp();
  const [view, setView] = useState(false);
  const Icon =
    entry.kind === "fuel"
      ? Fuel
      : entry.kind === "maintenance"
        ? Wrench
        : entry.kind === "odometer"
          ? Gauge
          : entry.kind === "note"
            ? FileText
            : ArrowUpRight;
  const vehicle = state.vehicles.find((v) => v.id === entry.vehicle_id);
  const attachments = state.attachments.filter((a) => a.event_id === entry.id);
  const [preview, setPreview] = useState<Attachment | null>(null);
  async function remove() {
    if (!confirm(tr("Удалить запись? После удаления её можно отменить.")))
      return;
    try {
      const deleted = await save("event", {}, entry, "delete");
      setView(false);
      notify(tr("Запись удалена"), () => {
        save("event", {}, deleted, "restore")
          .then(() => notify(tr("Запись восстановлена")))
          .catch((e) => notify(e.message));
      });
    } catch (error) {
      notify((error as Error).message);
    }
  }
  return (
    <>
      <div className="event-row">
        <button className="event-main" onClick={() => setView(true)}>
          <span className={`event-icon ${entry.kind}`}>
            <Icon size={19} />
          </span>
          <div className="event-text">
            <strong>{entry.description || kindNames[entry.kind]}</strong>
            <span>
              {vehicle?.name} <i>·</i> {dateLabel(entry.occurred_at)}
              {entry.odometer != null && (
                <>
                  {" "}
                  <i>·</i> {number(entry.odometer)} {tr(" км")}
                </>
              )}
              {entry.pending && <em> {tr(" · На устройстве")}</em>}
            </span>
          </div>
          <div className="event-amount">
            {entry.kind === "odometer"
              ? tr("{0} км", [number(entry.odometer)])
              : entry.kind === "note"
                ? tr("Заметка")
                : money(entry.amount_minor, entry.currency)}
            <small>
              {entry.kind === "fuel"
                ? tr("{0} л · {1}", [
                    number(Number(entry.liters), 2),
                    entry.station || entry.fuel,
                  ])
                : categoryLabel(entry.category || kindNames[entry.kind])}
            </small>
          </div>
          <ChevronRight className="event-chevron" size={16} />
        </button>
        {entry.can_edit !== false && (
          <button
            className="icon-button row-edit"
            aria-label={tr("Редактировать {0}", [
              entry.description || kindNames[entry.kind],
            ])}
            onClick={() => open(entry.kind, entry)}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      <Sheet
        open={view}
        onClose={() => setView(false)}
        title={entry.description || kindNames[entry.kind]}
      >
        <div className="record-detail">
          <div className={`detail-symbol event-icon ${entry.kind}`}>
            <Icon size={28} />
          </div>
          <h2>
            {entry.amount_minor
              ? money(entry.amount_minor, entry.currency)
              : kindNames[entry.kind]}
          </h2>
          <p className="muted">
            {vehicle?.name} · {dateLabel(entry.occurred_at)}
          </p>
          <dl>
            {[
              [
                tr("Пробег"),
                entry.odometer != null
                  ? tr("{0} км", [number(entry.odometer)])
                  : tr("Не указан"),
              ],
              [tr("Категория"), entry.category],
              [tr("Сервис / продавец"), entry.vendor],
              [tr("АЗС"), entry.station],
              [tr("Топливо"), entry.fuel],
              [tr("Литры"), entry.liters],
              [tr("Цена литра"), entry.price],
              [
                tr("Полный бак"),
                entry.kind === "fuel"
                  ? entry.full
                    ? tr("Да")
                    : tr("Нет")
                  : null,
              ],
              [tr("Теги"), entry.tags],
              [tr("Оплата"), entry.payment],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <ServiceLocation entry={entry} />
          {entry.items?.length > 0 && (
            <div className="detail-items">
              <h4>{tr("Запчасти и работы")}</h4>
              {entry.items.map((i, index) => (
                <div key={index}>
                  <span>
                    {i.name}
                    <small>
                      {i.part_number} · {i.quantity} {tr(" шт.")}
                    </small>
                  </span>
                  <strong>{money(i.amount_minor || 0, entry.currency)}</strong>
                </div>
              ))}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="detail-attachments">
              <h4>{tr("Вложения")}</h4>
              {attachments.map((a) => (
                <button key={a.id} onClick={() => setPreview(a)}>
                  <FileText size={18} />
                  {a.title}
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
          {entry.can_edit !== false && (
            <label className="file-attach">
              <Upload size={17} />
              {tr("Добавить вложение")}
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      const body = new FormData();
                      body.append("file", f);
                      body.append("vehicle_id", entry.vehicle_id);
                      body.append("event_id", entry.id);
                      await api(
                        "/attachments",
                        { method: "POST", body },
                        (await api<{ csrf: string }>("/session")).csrf,
                      );
                      await refresh();
                      notify(tr("Файл добавлен"));
                    } catch (error) {
                      notify((error as Error).message);
                    }
                  }
                }}
              />
            </label>
          )}
          {entry.can_edit !== false && (
            <div className="detail-actions">
              <Button
                variant="outline"
                onClick={() => {
                  setView(false);
                  open(entry.kind, entry);
                }}
              >
                <Pencil size={16} />
                {tr("Редактировать")}
              </Button>
              <Button variant="destructive" onClick={remove}>
                <Trash2 size={16} />
                {tr("Удалить")}
              </Button>
            </div>
          )}
        </div>
      </Sheet>
      {preview && state.attachments.some((a) => a.id === preview.id) && (
        <Preview attachment={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

export function VehiclePage() {
  const { state, selected, setPage, open, save, notify } = useApp();
  const v = state.vehicles.find((v) => v.id === selected);
  if (!v)
    return (
      <Empty
        title={tr("Выберите автомобиль")}
        description={tr("Вернитесь в гараж, чтобы открыть историю.")}
      />
    );
  const events = activeEvents(state, v.id);
  const month = sumEvents(
    events.filter((e) => e.occurred_at.slice(0, 10) >= monthStart()),
  );
  const year = sumEvents(
    events.filter((e) => e.occurred_at.startsWith(today().slice(0, 4))),
  );
  return (
    <>
      <button className="back-link" onClick={() => setPage("garage")}>
        <ChevronLeft size={17} />
        {tr("Мой гараж")}
      </button>
      <PageHeading
        eyebrow={`${v.brand || tr("МОЙ АВТОМОБИЛЬ")} · ${v.year || ""}`}
        title={v.name}
        description={
          [v.engine, v.transmission, v.drive].filter(Boolean).join(" · ") ||
          tr("Вся история вашего автомобиля")
        }
        action={
          v.can_edit !== false && (
            <div className="settings-actions">
              {" "}
              <Button variant="outline" onClick={() => open("vehicle", v)}>
                <Pencil size={16} />
                {tr("Редактировать")}
              </Button>
              <Suspense fallback={null}>
                <Sharing vehicleId={v.id} />
                <SaleReport vehicleId={v.id} />
              </Suspense>
            </div>
          )
        }
      />
      <section className="vehicle-hero panel">
        <div>
          {vehicleImage(v, true) ? (
            <img src={vehicleImage(v, true)} alt={v.name} decoding="async" />
          ) : (
            <CarFront size={120} strokeWidth={1} />
          )}
        </div>
        <aside>
          <span className="license-plate">{v.plate || tr("Без номера")}</span>
          <span className="eyebrow">{tr("ТЕКУЩИЙ ПРОБЕГ")}</span>
          <strong>
            {number(v.current_odometer)}
            <small>{tr("км")}</small>
          </strong>
          <button className="text-link" onClick={() => open("odometer")}>
            {tr("Обновить показание")}
            <ArrowUpRight size={16} />
          </button>
          <dl>
            {[
              ["VIN", v.vin],
              [tr("Поколение"), v.generation],
              [tr("Комплектация"), v.trim],
              [
                tr("Приобретён"),
                v.purchase_date ? dateLabel(v.purchase_date) : tr("Не указано"),
              ],
              [tr("Цена покупки"), money(v.purchase_minor || 0, v.currency)],
              [
                tr("Пробег при покупке"),
                number(v.purchase_odometer) + tr(" км"),
              ],
            ]
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </aside>
      </section>
      <section className="metrics-grid">
        <Metric
          label={tr("За всё время")}
          value={money(sumEvents(events))}
          detail={tr("Эксплуатационные расходы")}
        />
        <Metric label={tr("В этом месяце")} value={money(month)} />
        <Metric label={tr("В этом году")} value={money(year)} />
        <Metric
          label={tr("Пробег владения")}
          value={number(Math.max(0, v.current_odometer - v.purchase_odometer))}
          unit={tr("км")}
        />
      </section>
      <Suspense
        fallback={
          <div className="skeleton-panel" role="status">
            {tr("Открываем схему кузова…")}
          </div>
        }
      >
        <BodyDamage key={v.id} vehicleId={v.id} />
      </Suspense>
      <div className="section-heading">
        <h3>{tr("Последние события")}</h3>
        <Button size="sm" onClick={() => open("quick")}>
          <Plus size={16} />
          {tr("Новая запись")}
        </Button>
      </div>
      <div className="panel">
        {events.length ? (
          events
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .slice(0, 8)
            .map((e) => <EventRow key={e.id} entry={e} />)
        ) : (
          <Empty
            title={tr("Напишем первую главу?")}
            description={tr("Начните с заправки, покупки или обслуживания.")}
            onClick={() => open("quick")}
          />
        )}
      </div>
      <div className="section-heading">
        <h3>{tr("Ближайшие работы")}</h3>
        <button
          hidden={!state.vehicles.some((v) => v.can_edit !== false)}
          className="text-link"
          onClick={() => open("reminder")}
        >
          {tr("Добавить")}
          <Plus size={16} />
        </button>
      </div>
      <div className="reminder-grid">
        {state.reminders
          .filter((r) => r.vehicle_id === v.id && !r.deleted)
          .map((r) => (
            <ReminderCard key={r.id} reminder={r} />
          ))}
      </div>
      {v.can_edit !== false && (
        <div className="vehicle-archive">
          <p className="muted">
            {tr("История сохраняется даже после продажи автомобиля.")}
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await save(
                  "vehicle",
                  { status: v.status === "active" ? "archived" : "active" },
                  v,
                );
                notify(
                  v.status === "active"
                    ? tr("Автомобиль перенесён в архив")
                    : tr("Автомобиль возвращён в гараж"),
                );
              } catch (error) {
                notify((error as Error).message);
              }
            }}
          >
            {v.status === "active" ? (
              <Archive size={17} />
            ) : (
              <RotateCcw size={17} />
            )}{" "}
            {v.status === "active" ? tr("Архивировать") : tr("Вернуть в гараж")}
          </Button>
        </div>
      )}
    </>
  );
}

export function Timeline({ fixedKind }: { fixedKind?: string }) {
  const { state, selected, open } = useApp();
  const [car, setCar] = useState(selected);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState(fixedKind || "");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sort, setSort] = useState("desc");
  const [page, setPage] = useState(0);
  const filtered = activeEvents(state, car)
    .filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!category || e.category === category) &&
        (!start || e.occurred_at.slice(0, 10) >= start) &&
        (!end || e.occurred_at.slice(0, 10) <= end) &&
        JSON.stringify([e.description, e.items, e.vendor, e.tags, e.station])
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "desc"
        ? b.occurred_at.localeCompare(a.occurred_at)
        : a.occurred_at.localeCompare(b.occurred_at),
    );
  const visible = filtered.slice(page * 50, (page + 1) * 50);
  return (
    <>
      {!fixedKind && (
        <PageHeading
          eyebrow={tr("КАЖДАЯ ДЕТАЛЬ НА СВОЁМ МЕСТЕ")}
          title={tr("История автомобиля")}
          description={tr(
            "Заправки, обслуживание и моменты, которые стоит сохранить.",
          )}
          action={
            <Button onClick={() => open("quick")}>
              <Plus size={17} />
              {tr("Добавить запись")}
            </Button>
          }
        />
      )}
      <div className="filters">
        <VehicleSelect
          all
          value={car}
          onChange={(v) => {
            setCar(v);
            setPage(0);
          }}
        />
        <label className="search">
          <Search size={17} />
          <input
            aria-label={tr("Поиск по истории")}
            placeholder={tr("Событие, деталь, артикул…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {!fixedKind && (
          <select
            aria-label={tr("Тип события")}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{tr("Все события")}</option>
            {Object.entries(kindNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label={tr("Категория")}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{tr("Все категории")}</option>
          {[
            ...categories,
            ...state.categories.filter((c) => !c.deleted).map((c) => c.name),
          ].map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>
      <div className="period-filters">
        <label>
          {tr("С")}{" "}
          <input
            aria-label={tr("Начало периода")}
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          {tr("По")}{" "}
          <input
            aria-label={tr("Конец периода")}
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label={tr("Сортировка")}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="desc">{tr("Сначала новые")}</option>
          <option value="asc">{tr("Сначала старые")}</option>
        </select>
        <span>
          {filtered.length} {tr(" записей")}
        </span>
      </div>
      <div className="panel timeline-panel">
        {visible.length ? (
          visible.map((e) => <EventRow entry={e} key={e.id} />)
        ) : (
          <Empty
            icon={Clock3}
            title={tr("Пока нет событий")}
            description={tr("Добавьте запись или измените фильтры поиска.")}
            onClick={() =>
              open(
                fixedKind === "fuel"
                  ? "fuel"
                  : fixedKind === "maintenance"
                    ? "maintenance"
                    : "quick",
              )
            }
          />
        )}
      </div>
      {filtered.length > 50 && (
        <div className="pagination">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={17} />
            {tr("Назад")}
          </Button>
          <span>
            {page + 1} / {Math.ceil(filtered.length / 50)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 50 >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            {tr("Далее")}
            <ChevronRight size={17} />
          </Button>
        </div>
      )}
    </>
  );
}

export function FuelPage() {
  const { open, setPage, state, selected } = useApp();
  const events = activeEvents(state, selected).filter((e) => e.kind === "fuel");
  return (
    <>
      <PageHeading
        eyebrow={tr("ДО СЛЕДУЮЩЕЙ ПОЕЗДКИ")}
        title={tr("Заправки")}
        description={tr(
          "Литры, стоимость и реальный расход. Без предположений.",
        )}
        action={
          <Button onClick={() => open("fuel")}>
            <Plus size={17} />
            {tr("Заправить историю")}
          </Button>
        }
      />
      <section className="fuel-intro panel">
        <span className="fuel-symbol">
          <Fuel size={34} />
        </span>
        <div>
          <h3>{tr("От полного бака до полного бака")}</h3>
          <p>
            {tr(
              "Считаем расход только по завершённым циклам, включая частичные заправки. Если была пропущена запись, отметьте это в форме.",
            )}
          </p>
        </div>
        <button className="text-link" onClick={() => setPage("fuel-analytics")}>
          {tr("Графики и расход")}
          <ArrowUpRight size={17} />
        </button>
      </section>
      <section className="metrics-grid three">
        <Metric
          label={tr("Заправок в истории")}
          value={number(events.length)}
        />
        <Metric
          label={tr("Потрачено на топливо")}
          value={money(sumEvents(events))}
        />
        <Metric
          label={tr("Заправлено")}
          value={number(
            events
              .filter((e) => e.currency === "RUB")
              .reduce((s, e) => s + Number(e.liters), 0),
            1,
          )}
          unit={tr("л")}
        />
      </section>
      <Timeline fixedKind="fuel" />
    </>
  );
}
export function Maintenance() {
  return (
    <Suspense
      fallback={<p className="muted">{tr("Открываем обслуживание…")}</p>}
    >
      <OwnershipTools>
        <MaintenanceHistory />
      </OwnershipTools>
    </Suspense>
  );
}
function MaintenanceHistory() {
  const { open, state, selected } = useApp();
  return (
    <>
      <PageHeading
        eyebrow={tr("ЗАБОТА, КОТОРАЯ ОКУПАЕТСЯ")}
        title={tr("Обслуживание")}
        description={tr(
          "Работы, запчасти и их история. Машина в хороших руках.",
        )}
        action={
          <Button onClick={() => open("maintenance")}>
            <Plus size={17} />
            {tr("Записать обслуживание")}
          </Button>
        }
      />
      <div className="reminder-grid">
        {state.reminders
          .filter(
            (r) =>
              r.vehicle_id === selected &&
              !r.deleted &&
              r.enabled &&
              !r.completed_at,
          )
          .slice(0, 3)
          .map((r) => (
            <ReminderCard key={r.id} reminder={r} />
          ))}
      </div>
      <div className="section-heading">
        <h3>{tr("История работ")}</h3>
        <button
          hidden={!state.vehicles.some((v) => v.can_edit !== false)}
          className="text-link"
          onClick={() => open("reminder")}
        >
          {tr("Настроить интервал")}
          <Plus size={16} />
        </button>
      </div>
      <Timeline fixedKind="maintenance" />
    </>
  );
}

function ReminderCard({ reminder: r }: { reminder: Reminder }) {
  const { state, save, open, notify } = useApp();
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const car = state.vehicles.find((v) => v.id === r.vehicle_id);
  const warningKm = r.warning_km || 1000;
  const remaining = r.remaining_km;
  const progress =
    remaining != null
      ? Math.max(
          0,
          Math.min(100, (remaining / (r.repeat_km || warningKm * 3)) * 100),
        )
      : r.remaining_days != null
        ? Math.max(
            0,
            Math.min(100, (r.remaining_days / (r.repeat_days || 90)) * 100),
          )
        : 100;
  const names: Record<string, string> = {
    normal: tr("Всё по плану"),
    soon: tr("Скоро потребуется"),
    overdue: tr("Просрочено"),
    disabled: tr("Отключено"),
    completed: tr("Выполнено"),
  };
  return (
    <article className={`reminder-card panel ${r.status}`}>
      <div className="reminder-top">
        <span className="event-icon maintenance">
          <Wrench size={20} />
        </span>
        <span className={`status-pill ${r.status}`}>
          {names[r.status] || names.normal}
        </span>
        {r.can_edit !== false && (
          <button
            className="icon-button"
            aria-label={tr("Редактировать {0}", [r.title])}
            onClick={() => open("reminder", r)}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      <h3>{r.title}</h3>
      <p className="muted tiny">{car?.name}</p>
      <div className="reminder-resource">
        <strong>
          {remaining != null ? number(remaining) : number(r.remaining_days)}
          <small>{remaining != null ? tr("км") : tr("дней")}</small>
        </strong>
        <span>
          {tr("до обслуживания")}
          <br />
          {tr("расчётный остаток")}
        </span>
      </div>
      <div className="resource-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="reminder-targets">
        {r.due_date && (
          <span>
            <CalendarDays size={14} />
            {dateLabel(r.due_date)}
          </span>
        )}
        {r.due_odometer != null && (
          <span>
            <Gauge size={14} />
            {number(r.due_odometer)} {tr(" км")}
          </span>
        )}
      </div>
      {r.can_edit !== false && (
        <div className="reminder-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComplete(true)}
            disabled={r.status === "completed"}
          >
            <Check size={15} />
            {tr("Выполнено")}
          </Button>
          <button
            className="text-link"
            onClick={async () => {
              try {
                await save("reminder", { enabled: !r.enabled }, r);
                notify(
                  r.enabled
                    ? tr("Напоминание отключено")
                    : tr("Напоминание включено"),
                );
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            {r.enabled ? tr("Отключить") : tr("Включить")}
          </button>
        </div>
      )}
      <Sheet
        open={complete}
        onClose={() => setComplete(false)}
        title={tr("Обслуживание выполнено")}
      >
        <form
          className="record-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const values = Object.fromEntries(new FormData(e.currentTarget));
              await save("reminder", values, r, "complete");
              notify(tr("Обслуживание отмечено. Интервалы обновлены."));
              setComplete(false);
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {tr("Дата выполнения")}
            <input
              name="completion_date"
              type="date"
              defaultValue={today()}
              required
            />
          </label>
          <label>
            {tr("Подтверждённый пробег, км")}
            <input
              name="completion_odometer"
              type="number"
              placeholder={
                r.repeat_km ? tr("Пробег при выполнении") : tr("Необязательно")
              }
              required={!!r.repeat_km}
            />
          </label>
          <p className="field-help">
            {tr(
              "Повторяющееся напоминание будет отсчитано от этих значений. Пробег автомобиля автоматически не изменяется.",
            )}
          </p>
          <Button disabled={busy}>{tr("Подтвердить")}</Button>
        </form>
      </Sheet>
    </article>
  );
}
export function Reminders() {
  const { state, open } = useApp();
  const [filter, setFilter] = useState("active");
  const rows = state.reminders.filter(
    (r) => !r.deleted && (filter === "all" || (r.enabled && !r.completed_at)),
  );
  return (
    <>
      <PageHeading
        eyebrow={tr("СПОКОЙСТВИЕ В ДЕТАЛЯХ")}
        title={tr("Напоминания")}
        description={tr(
          "Меньше держать в голове. Больше наслаждаться дорогой.",
        )}
        action={
          <Button
            hidden={!state.vehicles.some((v) => v.can_edit !== false)}
            onClick={() => open("reminder")}
          >
            <Plus size={17} />
            {tr("Новое напоминание")}
          </Button>
        }
      />
      <div className="section-heading">
        <div className="tabs">
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            {tr("Активные")}
          </button>
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            {tr("Все напоминания")}
          </button>
        </div>
        <span className="tiny muted">
          {tr("Дата или пробег — что наступит раньше")}
        </span>
      </div>
      <div className="reminder-grid">
        {rows.map((r) => (
          <ReminderCard key={r.id} reminder={r} />
        ))}
      </div>
      {!rows.length && (
        <div className="panel">
          <Empty
            icon={Bell}
            title={tr("Важное не забудется")}
            description={tr(
              "Настройте замену масла, страховку или другую регулярную заботу.",
            )}
            onClick={
              state.vehicles.some((v) => v.can_edit !== false)
                ? () => open("reminder")
                : undefined
            }
          />
        </div>
      )}
    </>
  );
}

function Preview({
  attachment: a,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  return (
    <Sheet open title={a.title} onClose={onClose} wide>
      <div className="preview-body">
        {a.media_type.startsWith("image/") ? (
          <img src={fileURL(a.id)} alt={a.title} />
        ) : a.media_type === "application/pdf" ? (
          <iframe
            sandbox="allow-same-origin"
            title={a.title}
            src={fileURL(a.id)}
          />
        ) : (
          <Empty
            icon={FileText}
            title={tr("Файл готов к скачиванию")}
            description={tr("Предпросмотр этого формата не поддерживается.")}
          />
        )}
        <p className="muted tiny">
          {a.document_type} · {number(a.size / 1024)} {tr(" КБ")}
          {a.expires && tr(" · до {0}", [dateLabel(a.expires)])}
        </p>
        {a.notes && <p>{a.notes}</p>}
        <Button onClick={() => download(fileURL(a.id) + "?download=1")}>
          <Download size={17} />
          {tr("Скачать файл")}
        </Button>
      </div>
    </Sheet>
  );
}
export function Documents() {
  const { state, selected, open, session, refresh, notify } = useApp();
  const [query, setQuery] = useState("");
  const [car, setCar] = useState(selected);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [edit, setEdit] = useState<Attachment | null>(null);
  const rows = state.attachments.filter(
    (a) =>
      (!car || a.vehicle_id === car) &&
      JSON.stringify([a.title, a.document_type, a.notes])
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow={tr("ВСЁ НА СВОЁМ МЕСТЕ")}
        title={tr("Документы")}
        description={tr(
          "От первого договора до последнего чека. Только для вас.",
        )}
        action={
          state.vehicles.some((v) => v.can_edit !== false) && (
            <Button onClick={() => open("document")}>
              <Upload size={17} />
              {tr("Добавить документ")}
            </Button>
          )
        }
      />
      <div className="filters">
        <VehicleSelect all value={car} onChange={setCar} />
        <label className="search">
          <Search size={17} />
          <input
            aria-label={tr("Поиск документов")}
            placeholder={tr("Название, тип или заметка…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="documents-grid">
        {rows.map((a) => (
          <article className="document-card panel" key={a.id}>
            <button className="document-open" onClick={() => setPreview(a)}>
              <div
                className={`document-thumbnail ${a.media_type.startsWith("image/") ? "is-image" : ""}`}
              >
                {a.media_type.startsWith("image/") ? (
                  <img loading="lazy" src={fileURL(a.id)} alt="" />
                ) : (
                  <FileText size={38} strokeWidth={1} />
                )}
                <span>
                  {a.media_type === "application/pdf"
                    ? "PDF"
                    : a.media_type.startsWith("image/")
                      ? tr("ФОТО")
                      : tr("ФАЙЛ")}
                </span>
              </div>
              <div>
                <small>{a.document_type}</small>
                <h3>{a.title}</h3>
                <p>
                  {state.vehicles.find((v) => v.id === a.vehicle_id)?.name} ·{" "}
                  {number(a.size / 1024)} {tr(" КБ")}
                </p>
                {a.expires && (
                  <span className="document-expires">
                    {tr("Действует до ")}
                    {dateLabel(a.expires)}
                  </span>
                )}
              </div>
            </button>
            <div className="document-actions">
              {a.can_edit !== false && (
                <button className="text-link" onClick={() => setEdit(a)}>
                  <Pencil size={14} />
                  {tr("Изменить")}
                </button>
              )}
              <button
                className="icon-button"
                aria-label={tr("Скачать {0}", [a.title])}
                onClick={() => download(fileURL(a.id) + "?download=1")}
              >
                <Download size={17} />
              </button>
              {a.can_edit !== false && (
                <button
                  className="icon-button"
                  aria-label={tr("Удалить {0}", [a.title])}
                  onClick={async () => {
                    if (
                      confirm(
                        tr(
                          "Удалить документ? Копия останется только в ваших резервных архивах.",
                        ),
                      )
                    ) {
                      try {
                        await api(
                          "/attachments/" + a.id,
                          { method: "DELETE" },
                          session.csrf,
                        );
                        await refresh();
                        notify(tr("Документ удалён"));
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="panel">
          <Empty
            icon={FolderOpen}
            title={tr("Важные бумаги — всегда рядом")}
            description={tr(
              "Загрузите страховку, заказ-наряд или фото. Файлы хранятся на вашем сервере.",
            )}
            onClick={
              state.vehicles.some((v) => v.can_edit !== false)
                ? () => open("document")
                : undefined
            }
            label={tr("Добавить документ")}
          />
        </div>
      )}
      {preview && state.attachments.some((a) => a.id === preview.id) && (
        <Preview attachment={preview} onClose={() => setPreview(null)} />
      )}
      <Sheet
        open={
          !!edit &&
          state.attachments.some(
            (a) => a.id === edit.id && a.can_edit !== false,
          )
        }
        onClose={() => setEdit(null)}
        title={tr("Данные документа")}
      >
        {edit && (
          <form
            className="record-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const data = Object.fromEntries(new FormData(e.currentTarget));
                await api(
                  "/attachments/" + edit.id,
                  { method: "PATCH", body: JSON.stringify(data) },
                  session.csrf,
                );
                await refresh();
                setEdit(null);
                notify(tr("Документ обновлён"));
              } catch (error) {
                notify((error as Error).message);
              }
            }}
          >
            {(
              ["title", "document_type", "issued", "expires", "notes"] as const
            ).map((key) => (
              <label key={key}>
                {
                  {
                    title: tr("Название"),
                    document_type: "Тип",
                    issued: tr("Дата выдачи"),
                    expires: tr("Действует до"),
                    notes: tr("Заметка"),
                  }[key]
                }
                <input
                  name={key}
                  type={key === "issued" || key === "expires" ? "date" : "text"}
                  defaultValue={edit[key]}
                  required={key === "title"}
                />
              </label>
            ))}
            {edit.can_share && (
              <label>
                {tr("Доступ к документу")}
                <select
                  name="visibility"
                  defaultValue={edit.visibility || "owner"}
                >
                  <option value="owner">
                    {tr("Личный — владельцы и автор")}
                  </option>
                  <option value="shared">
                    {tr("Общий — участники автомобиля")}
                  </option>
                </select>
                <small>
                  {tr("Обложка автомобиля всегда доступна его участникам.")}
                </small>
              </label>
            )}
            <Button>{tr("Сохранить")}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}

export function SettingsPage() {
  const { session, state, save, open, notify, logout, resetDemo } = useApp();
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow={tr("ВАШ ГАРАЖ. ВАШИ ПРАВИЛА.")}
        title={tr("Настройки")}
        description={tr(
          "Приватность, сохранность данных и немного заботы о будущем.",
        )}
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <LanguagePicker
            onChange={(locale) => {
              void save("settings", { locale })
                .then(() => notify(tr("Язык сохранён")))
                .catch((error) => notify(tr(error.message)));
            }}
          />
        </section>
        <section className="panel settings-panel">
          <ShieldCheck size={27} />
          <h3>{tr("Данные принадлежат вам")}</h3>
          <p>
            {tr(
              "Все автомобили, документы и история находятся на вашем сервере. Без скрытой телеметрии и обязательных облаков.",
            )}
          </p>
          <dl>
            <div>
              <dt>{tr("Аккаунт")}</dt>
              <dd>{session.demo ? tr("Демо-гараж") : session.username}</dd>
            </div>
            <div>
              <dt>{tr("Режим")}</dt>
              <dd>
                {session.demo
                  ? tr("Изолированный демогараж")
                  : tr("Личный гараж")}
              </dd>
            </div>
            <div>
              <dt>{tr("Язык и единицы")}</dt>
              <dd>
                {
                  {
                    ru: "Русский · ₽ · км · л",
                    en: "English · ₽ · km · L",
                    de: "Deutsch · ₽ · km · l",
                    zh: "简体中文 · ₽ · km · L",
                    hi: "हिन्दी · ₽ · km · L",
                    es: "Español · ₽ · km · L",
                    ar: "العربية · ₽ · km · L",
                    fr: "Français · ₽ · km · L",
                  }[getLocale()]
                }
              </dd>
            </div>
          </dl>
          <Suspense fallback={null}>
            <Sharing />
            <Notifications />
            <MachineAccess />
          </Suspense>
          {session.demo && (
            <Button variant="outline" onClick={resetDemo}>
              <RotateCcw size={16} />
              {tr("Сбросить демонстрацию")}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => logout().catch((e) => notify(e.message))}
          >
            <LogOut size={16} />
            {tr("Выйти из гаража")}
          </Button>
        </section>
        {(session.is_admin || session.demo) && (
          <section className="panel settings-panel">
            <HardDrive size={27} />
            <h3>{tr("Резервная копия")}</h3>
            <p>
              {tr(
                "Полный архив содержит базу и все загруженные файлы. Он позволяет восстановить весь гараж.",
              )}
            </p>
            <div className="info-box">
              {tr(
                "Скачайте архив на другой физический диск. Копия рядом с базой не защитит от поломки накопителя.",
              )}
            </div>
            <Button
              disabled={session.demo}
              onClick={() => download("/api/v1/backup")}
            >
              <Download size={17} />
              {tr("Скачать полный архив")}
            </Button>
            <label className={`restore-file ${session.demo ? "disabled" : ""}`}>
              <Upload size={16} />
              {tr("Восстановить из архива")}
              <input
                type="file"
                accept=".zip"
                disabled={session.demo || busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    !confirm(
                      tr(
                        "Восстановление заменит текущие данные архивом. Скачайте текущий бэкап перед продолжением. Продолжить?",
                      ),
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api(
                      "/restore/stream",
                      {
                        method: "POST",
                        body: f,
                        headers: { "Content-Type": "application/zip" },
                      },
                      session.csrf,
                    );
                    notify(tr("Архив восстановлен. Войдите заново."));
                    location.reload();
                  } catch (error) {
                    notify((error as Error).message);
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {busy && (
              <p role="status">{tr("Проверяем и восстанавливаем архив…")}</p>
            )}
            {session.demo && (
              <small className="muted">
                {tr(
                  "Архивы доступны в личном гараже. Реальные данные недоступны из демо.",
                )}
              </small>
            )}
          </section>
        )}
        <section className="panel settings-panel">
          <FileText size={27} />
          <h3>{tr("Экспорт истории")}</h3>
          <p>
            {tr(
              "Связанные автомобили, операции, позиции и документы в открытых форматах. Идентификаторы сохраняются.",
            )}
          </p>
          <div className="settings-actions">
            <Button
              variant="outline"
              disabled={session.demo}
              onClick={() => download("/api/v1/export.json")}
            >
              JSON
              <Download size={15} />
            </Button>
            <Button
              variant="outline"
              disabled={session.demo}
              onClick={() => download("/api/v1/export.csv?readable=true")}
            >
              CSV
              <Download size={15} />
            </Button>
          </div>
        </section>
        <section className="panel settings-panel">
          <CarFront size={27} />
          <h3>{tr("Всегда под рукой")}</h3>
          <p>
            {tr(
              "Добавьте MASHINA на домашний экран. Ранее загруженный гараж и новые записи доступны без сети.",
            )}
          </p>
          <Button variant="outline" onClick={() => setInstall(true)}>
            <Plus size={16} />
            {tr("Как установить")}
          </Button>
          <p className="tiny muted">
            {tr(
              "Синхронизация происходит при открытом приложении. Вложения требуют подключения.",
            )}
          </p>
        </section>
      </div>
      <div className="section-heading">
        <h3>{tr("Ваши категории расходов")}</h3>
        <Button variant="outline" size="sm" onClick={() => open("category")}>
          <Plus size={16} />
          {tr("Новая категория")}
        </Button>
      </div>
      <div className="panel category-list">
        {categories.map((c) => (
          <span key={c}>{categoryLabel(c)}</span>
        ))}
        {state.categories
          .filter((c) => !c.deleted)
          .map((c) => (
            <span key={c.id}>
              {c.parent_id
                ? `${state.categories.find((p) => p.id === c.parent_id)?.name} / `
                : ""}
              {c.name}
              <button
                aria-label={tr("Удалить категорию {0}", [c.name])}
                onClick={() =>
                  save("category", {}, c, "delete").catch((e) =>
                    notify(e.message),
                  )
                }
              >
                <Trash2 size={13} />
              </button>
            </span>
          ))}
      </div>
      <Sheet
        open={install}
        onClose={() => setInstall(false)}
        title={tr("MASHINA на домашнем экране")}
      >
        <div className="record-detail">
          <h3>{tr("На iPhone")}</h3>
          <p>
            {tr(
              "Откройте приложение в Safari по HTTPS. Нажмите «Поделиться» → «На экран Домой» → «Добавить».",
            )}
          </p>
          <h3>{tr("На Android")}</h3>
          <p>
            {tr(
              "Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».",
            )}
          </p>
          <div className="info-box">
            {tr(
              "Один раз войдите и дождитесь загрузки гаража. Записи без сети сохраняются на этом устройстве. Не очищайте данные браузера до синхронизации.",
            )}
          </div>
          <p>
            {tr(
              "На общем устройстве выходите из гаража: локальный кэш и очередь будут удалены.",
            )}
          </p>
        </div>
      </Sheet>
    </>
  );
}
