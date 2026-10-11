import { useState, lazy, Suspense } from "react";
const OwnershipTools = lazy(() => import("./OwnershipTools"));
const Sharing = lazy(() => import("./Sharing"));
const SaleReport = lazy(() => import("./SaleReport"));
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
        <div className="eyebrow">{eyebrow}</div>
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
  label = "Добавить запись",
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
          {label}
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
        {label}
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
        aria-label="Автомобиль"
        value={value ?? selected}
        onChange={(e) => (onChange || setSelected)(e.target.value)}
      >
        {all && <option value="">Все автомобили</option>}
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
      name: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(d),
      value: sumEvents(entries.filter((e) => e.occurred_at.startsWith(key))),
    };
  });
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <>
      <PageHeading
        eyebrow="ВАШИ АВТОМОБИЛИ. ВАША ИСТОРИЯ."
        title="Мой гараж"
        description="Всё важное о ваших автомобилях — в одном месте."
        action={
          <Button variant="outline" onClick={() => open("vehicle")}>
            <Plus size={17} />
            Добавить автомобиль
          </Button>
        }
      />
      <section className="garage-summary">
        <div>
          <span className="summary-icon">
            <CarFront size={22} />
          </span>
          <div>
            <small>Автомобилей в гараже</small>
            <strong>
              {state.vehicles.filter((v) => v.status === "active").length}
              <span>авто</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <ArrowUpRight size={22} />
          </span>
          <div>
            <small>Расходы в этом месяце</small>
            <strong>{money(sumEvents(month))}</strong>
          </div>
        </div>
        <div>
          <span className="summary-icon">
            <Gauge size={22} />
          </span>
          <div>
            <small>Пробег за время владения</small>
            <strong>
              {number(
                state.vehicles.reduce(
                  (s, v) =>
                    s + Math.max(0, v.current_odometer - v.purchase_odometer),
                  0,
                ),
              )}
              <span>км</span>
            </strong>
          </div>
        </div>
        <div>
          <span className={`summary-icon ${reminders.length ? "lime" : ""}`}>
            <Bell size={21} />
          </span>
          <div>
            <small>Требует внимания</small>
            <strong>
              {reminders.length}
              <span>{reminders.length ? "напоминания" : "всё спокойно"}</span>
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
            В гараже{" "}
            <span>
              {state.vehicles.filter((v) => v.status === "active").length}
            </span>
          </button>
          <button
            className={tab === "archive" ? "active" : ""}
            onClick={() => setTab("archive")}
          >
            Архив{" "}
            <span>
              {state.vehicles.filter((v) => v.status !== "active").length}
            </span>
          </button>
        </div>
        <span className="tiny muted">У каждого автомобиля своя история</span>
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
          const image = vehicleImage(v);
          return (
            <article className="vehicle-card" key={v.id}>
              <button
                className="vehicle-open"
                aria-label={`Открыть ${v.name}`}
                onClick={() => {
                  setSelected(v.id);
                  setPage("vehicle");
                }}
              >
                <div
                  className={`vehicle-cover ${v.demo_image?.includes("porsche") ? "warm" : ""}`}
                >
                  {image ? (
                    <img src={image} alt={v.name} />
                  ) : (
                    <div className="vehicle-placeholder">
                      <CarFront size={80} strokeWidth={1} />
                      <span>Добавьте любимый ракурс</span>
                    </div>
                  )}
                  <span className="vehicle-badge">
                    {v.status === "active"
                      ? "В ГАРАЖЕ"
                      : v.status === "sold"
                        ? "ПРОДАН"
                        : "В АРХИВЕ"}
                  </span>
                  <span className="cover-arrow">
                    <ArrowUpRight size={20} />
                  </span>
                  <div className="cover-caption">
                    {v.demo_image
                      ? "MASHINA / DEMO COLLECTION"
                      : v.brand || "ВАШ АВТОМОБИЛЬ"}
                  </div>
                </div>
                <div className="vehicle-content">
                  <div className="vehicle-title">
                    <h2>{v.name}</h2>
                    <span>{v.year || "—"}</span>
                  </div>
                  <div className="vehicle-subtitle">
                    <span className="license-plate">
                      {v.plate || "Без номера"}
                    </span>
                    <span>
                      {v.engine || v.fuel || "Персональный автомобиль"}
                    </span>
                  </div>
                  <div className="vehicle-numbers">
                    <div>
                      <small>Пробег</small>
                      <strong>
                        {number(v.current_odometer)}
                        <span>км</span>
                      </strong>
                    </div>
                    <div>
                      <small>В этом месяце</small>
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
                      {next ? next.title : "Всё под контролем"}
                      {v.role === "driver" && <em> · Водитель</em>}
                    </span>
                    <small>
                      {next
                        ? next.remaining_km != null
                          ? `${number(next.remaining_km)} км`
                          : next.due_date
                            ? dateLabel(next.due_date)
                            : "Запланировано"
                        : "Нет ближайших работ"}
                    </small>
                  </div>
                </div>
              </button>
              {v.can_edit !== false && (
                <button
                  className="vehicle-more icon-button"
                  aria-label={`Редактировать ${v.name}`}
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
                  ? "Здесь начинается ваша история"
                  : "В архиве пока пусто"
              }
              description={
                tab === "active"
                  ? "Добавьте первый автомобиль. Все расходы, поездки и важные детали найдут своё место."
                  : "Проданные и архивные автомобили сохранят свою историю."
              }
              onClick={tab === "active" ? () => open("vehicle") : undefined}
              label="Добавить автомобиль"
            />
          </div>
        )}
      </section>
      <section className="dashboard-bottom">
        <div className="panel spending-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ПОД КОНТРОЛЕМ</span>
              <h3>Как меняются расходы</h3>
            </div>
            <button className="text-link" onClick={() => setPage("analytics")}>
              Аналитика
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="spending-total">
            {money(sumEvents(month))}
            <span>в этом месяце · RUB</span>
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
              Добавьте первый расход, и здесь появится ваша динамика.
            </p>
          )}
        </div>
        <div className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">НЕ УПУСТИТЬ ВАЖНОЕ</span>
              <h3>На горизонте</h3>
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
                      ? `${number(r.remaining_km)} км`
                      : dateLabel(r.due_date)}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <div className="calm-state">
              <ShieldCheck size={32} />
              <p>Можно просто наслаждаться дорогой.</p>
              <button
                hidden={!state.vehicles.some((v) => v.can_edit !== false)}
                className="text-link"
                onClick={() => open("reminder")}
              >
                Создать напоминание
                <Plus size={14} />
              </button>
            </div>
          )}
          <button
            className="panel-bottom-link"
            onClick={() => setPage("reminders")}
          >
            Все напоминания
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ИСТОРИЯ ПРОДОЛЖАЕТСЯ</span>
            <h3>Последние события</h3>
          </div>
          <button className="text-link" onClick={() => setPage("timeline")}>
            Вся история
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
            title="Ни одна деталь не потеряется"
            description="Запишите первую заправку, обслуживание или просто важный момент."
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
    if (!confirm("Удалить запись? После удаления её можно отменить.")) return;
    try {
      const deleted = await save("event", {}, entry, "delete");
      setView(false);
      notify("Запись удалена", () => {
        save("event", {}, deleted, "restore")
          .then(() => notify("Запись восстановлена"))
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
                  <i>·</i> {number(entry.odometer)} км
                </>
              )}
              {entry.pending && <em> · На устройстве</em>}
            </span>
          </div>
          <div className="event-amount">
            {entry.kind === "odometer"
              ? `${number(entry.odometer)} км`
              : entry.kind === "note"
                ? "Заметка"
                : money(entry.amount_minor, entry.currency)}
            <small>
              {entry.kind === "fuel"
                ? `${number(Number(entry.liters), 2)} л · ${entry.station || entry.fuel}`
                : entry.category || kindNames[entry.kind]}
            </small>
          </div>
          <ChevronRight className="event-chevron" size={16} />
        </button>
        {entry.can_edit !== false && (
          <button
            className="icon-button row-edit"
            aria-label={`Редактировать ${entry.description || kindNames[entry.kind]}`}
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
                "Пробег",
                entry.odometer != null
                  ? `${number(entry.odometer)} км`
                  : "Не указан",
              ],
              ["Категория", entry.category],
              ["Сервис / продавец", entry.vendor],
              ["АЗС", entry.station],
              ["Топливо", entry.fuel],
              ["Литры", entry.liters],
              ["Цена литра", entry.price],
              [
                "Полный бак",
                entry.kind === "fuel" ? (entry.full ? "Да" : "Нет") : null,
              ],
              ["Теги", entry.tags],
              ["Оплата", entry.payment],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {entry.items?.length > 0 && (
            <div className="detail-items">
              <h4>Запчасти и работы</h4>
              {entry.items.map((i, index) => (
                <div key={index}>
                  <span>
                    {i.name}
                    <small>
                      {i.part_number} · {i.quantity} шт.
                    </small>
                  </span>
                  <strong>{money(i.amount_minor || 0, entry.currency)}</strong>
                </div>
              ))}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="detail-attachments">
              <h4>Вложения</h4>
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
              Добавить вложение
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
                      notify("Файл добавлен");
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
                Редактировать
              </Button>
              <Button variant="destructive" onClick={remove}>
                <Trash2 size={16} />
                Удалить
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
        title="Выберите автомобиль"
        description="Вернитесь в гараж, чтобы открыть историю."
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
        Мой гараж
      </button>
      <PageHeading
        eyebrow={`${v.brand || "МОЙ АВТОМОБИЛЬ"} · ${v.year || ""}`}
        title={v.name}
        description={
          [v.engine, v.transmission, v.drive].filter(Boolean).join(" · ") ||
          "Вся история вашего автомобиля"
        }
        action={
          v.can_edit !== false && (
            <div className="settings-actions">
              {" "}
              <Button variant="outline" onClick={() => open("vehicle", v)}>
                <Pencil size={16} />
                Редактировать
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
          {vehicleImage(v) ? (
            <img src={vehicleImage(v)} alt={v.name} />
          ) : (
            <CarFront size={120} strokeWidth={1} />
          )}
        </div>
        <aside>
          <span className="license-plate">{v.plate || "Без номера"}</span>
          <span className="eyebrow">ТЕКУЩИЙ ПРОБЕГ</span>
          <strong>
            {number(v.current_odometer)}
            <small>км</small>
          </strong>
          <button className="text-link" onClick={() => open("odometer")}>
            Обновить показание
            <ArrowUpRight size={16} />
          </button>
          <dl>
            {[
              ["VIN", v.vin],
              ["Поколение", v.generation],
              ["Комплектация", v.trim],
              [
                "Приобретён",
                v.purchase_date ? dateLabel(v.purchase_date) : "Не указано",
              ],
              ["Цена покупки", money(v.purchase_minor || 0, v.currency)],
              ["Пробег при покупке", number(v.purchase_odometer) + " км"],
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
          label="За всё время"
          value={money(sumEvents(events))}
          detail="Эксплуатационные расходы"
        />
        <Metric label="В этом месяце" value={money(month)} />
        <Metric label="В этом году" value={money(year)} />
        <Metric
          label="Пробег владения"
          value={number(Math.max(0, v.current_odometer - v.purchase_odometer))}
          unit="км"
        />
      </section>
      <div className="section-heading">
        <h3>Последние события</h3>
        <Button size="sm" onClick={() => open("quick")}>
          <Plus size={16} />
          Новая запись
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
            title="Напишем первую главу?"
            description="Начните с заправки, покупки или обслуживания."
            onClick={() => open("quick")}
          />
        )}
      </div>
      <div className="section-heading">
        <h3>Ближайшие работы</h3>
        <button
          hidden={!state.vehicles.some((v) => v.can_edit !== false)}
          className="text-link"
          onClick={() => open("reminder")}
        >
          Добавить
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
            История сохраняется даже после продажи автомобиля.
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
                    ? "Автомобиль перенесён в архив"
                    : "Автомобиль возвращён в гараж",
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
            {v.status === "active" ? "Архивировать" : "Вернуть в гараж"}
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
          eyebrow="КАЖДАЯ ДЕТАЛЬ НА СВОЁМ МЕСТЕ"
          title="История автомобиля"
          description="Заправки, обслуживание и моменты, которые стоит сохранить."
          action={
            <Button onClick={() => open("quick")}>
              <Plus size={17} />
              Добавить запись
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
            aria-label="Поиск по истории"
            placeholder="Событие, деталь, артикул…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {!fixedKind && (
          <select
            aria-label="Тип события"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Все события</option>
            {Object.entries(kindNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Категория"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Все категории</option>
          {[
            ...categories,
            ...state.categories.filter((c) => !c.deleted).map((c) => c.name),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="period-filters">
        <label>
          С{" "}
          <input
            aria-label="Начало периода"
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          По{" "}
          <input
            aria-label="Конец периода"
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
        <span>{filtered.length} записей</span>
      </div>
      <div className="panel timeline-panel">
        {visible.length ? (
          visible.map((e) => <EventRow entry={e} key={e.id} />)
        ) : (
          <Empty
            icon={Clock3}
            title="Пока нет событий"
            description="Добавьте запись или измените фильтры поиска."
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
            Назад
          </Button>
          <span>
            {page + 1} / {Math.ceil(filtered.length / 50)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 50 >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее
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
        eyebrow="ДО СЛЕДУЮЩЕЙ ПОЕЗДКИ"
        title="Заправки"
        description="Литры, стоимость и реальный расход. Без предположений."
        action={
          <Button onClick={() => open("fuel")}>
            <Plus size={17} />
            Заправить историю
          </Button>
        }
      />
      <section className="fuel-intro panel">
        <span className="fuel-symbol">
          <Fuel size={34} />
        </span>
        <div>
          <h3>От полного бака до полного бака</h3>
          <p>
            Считаем расход только по завершённым циклам, включая частичные
            заправки. Если была пропущена запись, отметьте это в форме.
          </p>
        </div>
        <button className="text-link" onClick={() => setPage("analytics")}>
          Графики и расход
          <ArrowUpRight size={17} />
        </button>
      </section>
      <section className="metrics-grid three">
        <Metric label="Заправок в истории" value={number(events.length)} />
        <Metric label="Потрачено на топливо" value={money(sumEvents(events))} />
        <Metric
          label="Заправлено"
          value={number(
            events
              .filter((e) => e.currency === "RUB")
              .reduce((s, e) => s + Number(e.liters), 0),
            1,
          )}
          unit="л"
        />
      </section>
      <Timeline fixedKind="fuel" />
    </>
  );
}
export function Maintenance() {
  return (
    <Suspense fallback={<p className="muted">Открываем обслуживание…</p>}>
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
        eyebrow="ЗАБОТА, КОТОРАЯ ОКУПАЕТСЯ"
        title="Обслуживание"
        description="Работы, запчасти и их история. Машина в хороших руках."
        action={
          <Button onClick={() => open("maintenance")}>
            <Plus size={17} />
            Записать обслуживание
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
        <h3>История работ</h3>
        <button
          hidden={!state.vehicles.some((v) => v.can_edit !== false)}
          className="text-link"
          onClick={() => open("reminder")}
        >
          Настроить интервал
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
    normal: "Всё по плану",
    soon: "Скоро потребуется",
    overdue: "Просрочено",
    disabled: "Отключено",
    completed: "Выполнено",
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
            aria-label={`Редактировать ${r.title}`}
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
          <small>{remaining != null ? "км" : "дней"}</small>
        </strong>
        <span>
          до обслуживания
          <br />
          расчётный остаток
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
            {number(r.due_odometer)} км
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
            Выполнено
          </Button>
          <button
            className="text-link"
            onClick={async () => {
              try {
                await save("reminder", { enabled: !r.enabled }, r);
                notify(
                  r.enabled ? "Напоминание отключено" : "Напоминание включено",
                );
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            {r.enabled ? "Отключить" : "Включить"}
          </button>
        </div>
      )}
      <Sheet
        open={complete}
        onClose={() => setComplete(false)}
        title="Обслуживание выполнено"
      >
        <form
          className="record-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const values = Object.fromEntries(new FormData(e.currentTarget));
              await save("reminder", values, r, "complete");
              notify("Обслуживание отмечено. Интервалы обновлены.");
              setComplete(false);
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Дата выполнения
            <input
              name="completion_date"
              type="date"
              defaultValue={today()}
              required
            />
          </label>
          <label>
            Подтверждённый пробег, км
            <input
              name="completion_odometer"
              type="number"
              defaultValue={car?.current_odometer || 0}
              required
            />
          </label>
          <p className="field-help">
            Повторяющееся напоминание будет отсчитано от этих значений. Пробег
            автомобиля автоматически не изменяется.
          </p>
          <Button disabled={busy}>Подтвердить</Button>
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
        eyebrow="СПОКОЙСТВИЕ В ДЕТАЛЯХ"
        title="Напоминания"
        description="Меньше держать в голове. Больше наслаждаться дорогой."
        action={
          <Button
            hidden={!state.vehicles.some((v) => v.can_edit !== false)}
            onClick={() => open("reminder")}
          >
            <Plus size={17} />
            Новое напоминание
          </Button>
        }
      />
      <div className="section-heading">
        <div className="tabs">
          <button
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Активные
          </button>
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Все напоминания
          </button>
        </div>
        <span className="tiny muted">
          Дата или пробег — что наступит раньше
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
            title="Важное не забудется"
            description="Настройте замену масла, страховку или другую регулярную заботу."
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
            title="Файл готов к скачиванию"
            description="Предпросмотр этого формата не поддерживается."
          />
        )}
        <p className="muted tiny">
          {a.document_type} · {number(a.size / 1024)} КБ
          {a.expires && ` · до ${dateLabel(a.expires)}`}
        </p>
        {a.notes && <p>{a.notes}</p>}
        <Button onClick={() => download(fileURL(a.id) + "?download=1")}>
          <Download size={17} />
          Скачать файл
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
        eyebrow="ВСЁ НА СВОЁМ МЕСТЕ"
        title="Документы"
        description="От первого договора до последнего чека. Только для вас."
        action={
          state.vehicles.some((v) => v.can_edit !== false) && (
            <Button onClick={() => open("document")}>
              <Upload size={17} />
              Добавить документ
            </Button>
          )
        }
      />
      <div className="filters">
        <VehicleSelect all value={car} onChange={setCar} />
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Поиск документов"
            placeholder="Название, тип или заметка…"
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
                      ? "ФОТО"
                      : "ФАЙЛ"}
                </span>
              </div>
              <div>
                <small>{a.document_type}</small>
                <h3>{a.title}</h3>
                <p>
                  {state.vehicles.find((v) => v.id === a.vehicle_id)?.name} ·{" "}
                  {number(a.size / 1024)} КБ
                </p>
                {a.expires && (
                  <span className="document-expires">
                    Действует до {dateLabel(a.expires)}
                  </span>
                )}
              </div>
            </button>
            <div className="document-actions">
              {a.can_edit !== false && (
                <button className="text-link" onClick={() => setEdit(a)}>
                  <Pencil size={14} />
                  Изменить
                </button>
              )}
              <button
                className="icon-button"
                aria-label={`Скачать ${a.title}`}
                onClick={() => download(fileURL(a.id) + "?download=1")}
              >
                <Download size={17} />
              </button>
              {a.can_edit !== false && (
                <button
                  className="icon-button"
                  aria-label={`Удалить ${a.title}`}
                  onClick={async () => {
                    if (
                      confirm(
                        "Удалить документ? Копия останется только в ваших резервных архивах.",
                      )
                    ) {
                      try {
                        await api(
                          "/attachments/" + a.id,
                          { method: "DELETE" },
                          session.csrf,
                        );
                        await refresh();
                        notify("Документ удалён");
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
            title="Важные бумаги — всегда рядом"
            description="Загрузите страховку, заказ-наряд или фото. Файлы хранятся на вашем сервере."
            onClick={
              state.vehicles.some((v) => v.can_edit !== false)
                ? () => open("document")
                : undefined
            }
            label="Добавить документ"
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
        title="Данные документа"
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
                notify("Документ обновлён");
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
                    title: "Название",
                    document_type: "Тип",
                    issued: "Дата выдачи",
                    expires: "Действует до",
                    notes: "Заметка",
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
                Доступ к документу
                <select
                  name="visibility"
                  defaultValue={edit.visibility || "owner"}
                >
                  <option value="owner">Личный — владельцы и автор</option>
                  <option value="shared">Общий — участники автомобиля</option>
                </select>
                <small>
                  Обложка автомобиля всегда доступна его участникам.
                </small>
              </label>
            )}
            <Button>Сохранить</Button>
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
        eyebrow="ВАШ ГАРАЖ. ВАШИ ПРАВИЛА."
        title="Настройки"
        description="Приватность, сохранность данных и немного заботы о будущем."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <ShieldCheck size={27} />
          <h3>Данные принадлежат вам</h3>
          <p>
            Все автомобили, документы и история находятся на вашем сервере. Без
            скрытой телеметрии и обязательных облаков.
          </p>
          <dl>
            <div>
              <dt>Аккаунт</dt>
              <dd>{session.username}</dd>
            </div>
            <div>
              <dt>Режим</dt>
              <dd>
                {session.demo ? "Изолированный демогараж" : "Личный гараж"}
              </dd>
            </div>
            <div>
              <dt>Язык и единицы</dt>
              <dd>Русский · ₽ · км · л</dd>
            </div>
          </dl>
          <Suspense fallback={null}>
            <Sharing />
          </Suspense>
          {session.demo && (
            <Button variant="outline" onClick={resetDemo}>
              <RotateCcw size={16} />
              Сбросить демонстрацию
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => logout().catch((e) => notify(e.message))}
          >
            <LogOut size={16} />
            Выйти из гаража
          </Button>
        </section>
        {session.is_admin ||
          (session.demo && (
            <section className="panel settings-panel">
              <HardDrive size={27} />
              <h3>Резервная копия</h3>
              <p>
                Полный архив содержит базу и все загруженные файлы. Он позволяет
                восстановить весь гараж.
              </p>
              <div className="info-box">
                Скачайте архив на другой физический диск. Копия рядом с базой не
                защитит от поломки накопителя.
              </div>
              <Button
                disabled={session.demo}
                onClick={() => download("/api/v1/backup")}
              >
                <Download size={17} />
                Скачать полный архив
              </Button>
              <label
                className={`restore-file ${session.demo ? "disabled" : ""}`}
              >
                <Upload size={16} />
                Восстановить из архива
                <input
                  type="file"
                  accept=".zip"
                  disabled={session.demo || busy}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (
                      !confirm(
                        "Восстановление заменит текущие данные архивом. Скачайте текущий бэкап перед продолжением. Продолжить?",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      const body = new FormData();
                      body.append("file", f);
                      await api(
                        "/restore",
                        { method: "POST", body },
                        session.csrf,
                      );
                      notify("Архив восстановлен. Войдите заново.");
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
              {busy && <p role="status">Проверяем и восстанавливаем архив…</p>}
              {session.demo && (
                <small className="muted">
                  Архивы доступны в личном гараже. Реальные данные недоступны из
                  демо.
                </small>
              )}
            </section>
          ))}
        <section className="panel settings-panel">
          <FileText size={27} />
          <h3>Экспорт истории</h3>
          <p>
            Связанные автомобили, операции, позиции и документы в открытых
            форматах. Идентификаторы сохраняются.
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
              onClick={() => download("/api/v1/export.csv")}
            >
              CSV
              <Download size={15} />
            </Button>
          </div>
        </section>
        <section className="panel settings-panel">
          <CarFront size={27} />
          <h3>Всегда под рукой</h3>
          <p>
            Добавьте MASHINA на домашний экран. Ранее загруженный гараж и новые
            записи доступны без сети.
          </p>
          <Button variant="outline" onClick={() => setInstall(true)}>
            <Plus size={16} />
            Как установить
          </Button>
          <p className="tiny muted">
            Синхронизация происходит при открытом приложении. Вложения требуют
            подключения.
          </p>
        </section>
      </div>
      <div className="section-heading">
        <h3>Ваши категории расходов</h3>
        <Button variant="outline" size="sm" onClick={() => open("category")}>
          <Plus size={16} />
          Новая категория
        </Button>
      </div>
      <div className="panel category-list">
        {categories.map((c) => (
          <span key={c}>{c}</span>
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
                aria-label={`Удалить категорию ${c.name}`}
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
        title="MASHINA на домашнем экране"
      >
        <div className="record-detail">
          <h3>На iPhone</h3>
          <p>
            Откройте приложение в Safari по HTTPS. Нажмите «Поделиться» → «На
            экран Домой» → «Добавить».
          </p>
          <h3>На Android</h3>
          <p>
            Откройте меню браузера и выберите «Установить приложение» или
            «Добавить на главный экран».
          </p>
          <div className="info-box">
            Один раз войдите и дождитесь загрузки гаража. Записи без сети
            сохраняются на этом устройстве. Не очищайте данные браузера до
            синхронизации.
          </div>
          <p>
            На общем устройстве выходите из гаража: локальный кэш и очередь
            будут удалены.
          </p>
        </div>
      </Sheet>
    </>
  );
}
