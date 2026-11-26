import { VehicleIdentityFields } from "./VehicleIdentityFields";
import {
  CURRENCIES,
  categories,
  categoryLabel,
  currencySymbol,
  defaultCurrency,
  distanceUnit,
  kindNames,
  money,
  today,
  volumeUnit,
} from "./utils";
import { tr } from "./i18n";
import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  Fuel,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useApp, type RecordFormOptions } from "./context";
import type {
  InspectionStatus,
  Item,
  Kind,
  RecordBase,
  RenewalData,
  RenewalSchedule,
} from "./types";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { OcrReview, type OcrFields } from "./OcrReview";
import { FuelDetailsFields } from "./FuelDetailsFields";
import { inspectionLabels, renewalLabels } from "./renewals";

const maintenanceTemplates = [
  "Замена моторного масла",
  "Замена фильтров",
  "Замена свечей",
  "Тормозные колодки",
  "Тормозная жидкость",
  "Масло в коробке",
  "Замена аккумулятора",
  "Сезонная смена шин",
];
const clockOptions = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, "0"),
);

function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  placeholder = "",
  step,
  list,
  readOnly = false,
  children,
}: {
  label: string;
  name: string;
  value?: any;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  list?: string;
  readOnly?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label>
      {tr(label)}
      {children || (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          placeholder={placeholder}
          step={step}
          list={list}
          readOnly={readOnly}
          inputMode={type === "number" ? "decimal" : undefined}
        />
      )}
    </label>
  );
}

export function RecordForm({
  type,
  record,
  onClose,
  serviceVisitDraft,
  renewalType,
  reminderDraft,
}: {
  type: Kind | "vehicle" | "reminder" | "document" | "category";
  record?: RecordBase;
  onClose: () => void;
} & RecordFormOptions) {
  const { state, selected, save, upload, notify, refresh } = useApp();
  const renewal =
    type === "expense"
      ? (record?.renewal as RenewalData | undefined)
      : undefined;
  const renewalKind = renewal?.type ?? renewalType;
  const reminderRenewalType =
    type === "reminder"
      ? ((record?.renewal_schedule as RenewalSchedule | undefined)?.type ??
        reminderDraft?.renewalType)
      : undefined;
  const allowedVehicles = state.vehicles.filter(
    (v) => !["reminder", "document"].includes(type) || v.can_edit !== false,
  );
  const [vehicleId, setVehicleId] = useState(
    record?.vehicle_id ||
      serviceVisitDraft?.vehicleId ||
      allowedVehicles.find((v) => v.id === selected)?.id ||
      allowedVehicles[0]?.id ||
      "",
  );
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<RecordBase | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<Item[]>(record?.items || []);
  const [openedAt] = useState(() => new Date());
  const [fuelValues, setFuelValues] = useState({
    liters: record?.liters || "",
    price: record?.price || "",
    amount: record?.amount || "",
  });
  const form = useRef<HTMLFormElement>(null);
  const title = renewalKind
    ? tr(renewalLabels[renewalKind])
    : type === "vehicle"
      ? record
        ? tr("Профиль автомобиля")
        : tr("Новый автомобиль")
      : type === "document"
        ? tr("Добавить документ")
        : type === "reminder"
          ? record
            ? tr("Настроить напоминание")
            : tr("Новое напоминание")
          : type === "category"
            ? tr("Новая категория")
            : `${record ? tr("Редактировать · ") : ""}${kindNames[type]}`;
  function close() {
    if (
      dirty &&
      !confirm(tr("Закрыть форму и потерять несохранённые изменения?"))
    )
      return;
    onClose();
  }
  function chooseFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    if (list.some((f) => f.size > 20 * 1024 * 1024)) {
      setError(tr("Каждый файл должен быть меньше 20 МБ"));
      return;
    }
    setFiles(list);
    setDirty(true);
  }
  function updateItem(index: number, key: keyof Item, value: string) {
    setItems((prev) =>
      prev.map((i, n) => (n === index ? { ...i, [key]: value } : i)),
    );
    setDirty(true);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data: Record<string, any> = Object.fromEntries(
        new FormData(e.currentTarget),
      );
      delete data.file;
      for (const key of ["full", "gap", "odometer_confirmed", "enabled"])
        if (form.current?.elements.namedItem(key))
          data[key] = (
            form.current.elements.namedItem(key) as HTMLInputElement
          ).checked;
      if (type !== "vehicle" && type !== "category")
        data.vehicle_id = vehicleId;
      if (reminderRenewalType) {
        data.renewal_schedule = {
          type: reminderRenewalType,
          lead_days: Number(data.warning_days),
        };
      }
      if (type === "document") {
        if (!files.length)
          throw new Error(tr("Выберите документ для загрузки"));
        await upload(files[0], data as Record<string, string>);
      } else {
        if (
          ["expense", "fuel", "maintenance", "odometer", "note"].includes(type)
        ) {
          data.kind = type;
          data.items = items;
          if (type === "maintenance") {
            const concernIds =
              serviceVisitDraft?.concernIds ??
              record?.service_visit?.concern_ids ??
              [];
            if (concernIds.length || data.service_visit_follow_up.trim()) {
              data.service_visit = {
                concern_ids: concernIds,
                follow_up: data.service_visit_follow_up.trim(),
              };
            } else if (record?.service_visit) {
              data.service_visit = null;
            }
            delete data.service_visit_follow_up;
          }
          if (type === "expense" && renewalKind) {
            if (data.renewal_expires_on < data.occurred_at.slice(0, 10))
              throw new Error(
                tr("Срок действия не может закончиться до даты оплаты."),
              );
            const nextRenewal: RenewalData = {
              type: renewalKind,
              expires_on: data.renewal_expires_on,
            };
            if (renewalKind === "registration")
              nextRenewal.inspection_status =
                data.renewal_inspection as InspectionStatus;
            data.renewal = nextRenewal;
            delete data.renewal_expires_on;
            delete data.renewal_inspection;
          }
          if (type === "fuel") {
            const { occurred_hour, occurred_minute } = data;
            data.occurred_at += `T${occurred_hour}:${occurred_minute}`;
            delete data.occurred_hour;
            delete data.occurred_minute;
            Object.assign(data, fuelValues);
          }
        }
        const entity =
          type === "vehicle"
            ? "vehicle"
            : type === "category"
              ? "category"
              : type === "reminder"
                ? "reminder"
                : "event";
        const reminderId = data.next_reminder;
        delete data.next_reminder;
        if (
          reminderId &&
          state.reminders.find((r) => r.id === reminderId)?.repeat_km &&
          (data.odometer === "" || data.odometer == null)
        )
          throw new Error(
            tr(
              "Для повторения ТО по километрам укажите подтверждённый пробег при выполнении.",
            ),
          );
        const result = await save(entity, data, saved || record);
        setSaved(result);
        if (files.length) {
          if (result.pending)
            throw new Error(
              tr(
                "Запись сохранена офлайн. Файлы выберите и загрузите после синхронизации.",
              ),
            );
          for (const file of files) {
            const attachment = await upload(file, {
              vehicle_id: type === "vehicle" ? result.id : vehicleId,
              event_id: entity === "event" ? result.id : "",
              title: file.name,
              document_type: renewalKind
                ? "Прочее"
                : type === "maintenance"
                  ? "Заказ-наряд"
                  : type === "fuel"
                    ? "Чек"
                    : "Фотография",
            });
            if (type === "vehicle")
              await save(
                "vehicle",
                { ...result, photo_id: attachment.id },
                result,
              );
          }
        }
        if (reminderId) {
          const reminder = state.reminders.find((r) => r.id === reminderId);
          if (reminder)
            await save(
              "reminder",
              {
                completion_date: data.occurred_at,
                completion_odometer:
                  data.odometer === "" ? undefined : data.odometer,
              },
              reminder,
              "complete",
            );
        }
      }
      setDirty(false);
      notify(
        record
          ? tr("Изменения сохранены")
          : tr("Готово. История стала полнее."),
      );
      await refresh().catch(() => {});
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const allCategories = [
    ...categories,
    ...state.categories.filter((c) => !c.deleted).map((c) => c.name),
  ];
  function applyOcr(
    fields: OcrFields,
    source?: File,
    recognizedItems: Item[] = [],
  ) {
    if (recognizedItems.length && items.length)
      throw new Error(
        tr("В записи уже есть позиции. Добавьте новые вручную после проверки."),
      );
    if (fields.amount && items.length)
      throw new Error(
        tr(
          "В записи уже есть позиции. Проверьте их итог перед переносом суммы.",
        ),
      );
    for (const [name, value] of Object.entries(fields)) {
      if (type === "fuel" && ["amount", "liters", "price"].includes(name))
        continue;
      const input = form.current?.elements.namedItem(name) as
        HTMLInputElement | HTMLTextAreaElement | null;
      if (input)
        input.value =
          name === "occurred_at" && type !== "fuel" ? value + "T12:00" : value;
    }
    if (type === "fuel")
      setFuelValues((current) => ({
        ...current,
        ...(fields.amount === undefined ? {} : { amount: fields.amount }),
        ...(fields.liters === undefined ? {} : { liters: fields.liters }),
        ...(fields.price === undefined ? {} : { price: fields.price }),
      }));
    if (source) setFiles((current) => [...current, source]);
    if (recognizedItems.length) setItems(recognizedItems);
    setDirty(true);
  }
  const dUnit = distanceUnit(state);
  const vUnit = volumeUnit(state);
  const activeCurrency =
    record?.currency ||
    (type === "vehicle"
      ? defaultCurrency(state)
      : defaultCurrency(state, vehicle));
  const sym = currencySymbol(activeCurrency);
  const purchasePriceLabel =
    activeCurrency === "RUB"
      ? tr("Цена покупки, ₽")
      : `${tr("Цена покупки")}, ${sym}`;
  const amountLabel =
    activeCurrency === "RUB" ? tr("Сумма, ₽") : `${tr("Сумма")}, ${sym}`;
  const unitPriceLabel =
    activeCurrency === "RUB" ? tr("Цена, ₽") : `${tr("Цена")}, ${sym}`;
  const discountLabel =
    activeCurrency === "RUB" ? tr("Скидка, ₽") : `${tr("Скидка")}, ${sym}`;
  const adjustmentLabel =
    activeCurrency === "RUB"
      ? tr("Корректировка итога, ₽ (можно отрицательную)")
      : `${tr("Корректировка итога (можно отрицательную)")}, ${sym}`;
  const fuelVolumeLabel = vUnit === "l" ? tr("Литры") : tr("Галлоны");
  const fuelPriceLabel =
    vUnit === "l"
      ? activeCurrency === "RUB"
        ? tr("Цена за литр, ₽")
        : `${tr("Цена за литр")}, ${sym}`
      : activeCurrency === "RUB"
        ? tr("Цена за галлон, ₽")
        : `${tr("Цена за галлон")}, ${sym}`;
  return (
    <Sheet open onClose={close} title={tr(title)} wide={type === "vehicle"}>
      <form
        ref={form}
        className="record-form"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <datalist id="currency-options">
          {CURRENCIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {type !== "vehicle" && type !== "category" && (
          <label>
            {tr("Автомобиль")}
            <select
              value={vehicleId}
              disabled={!!serviceVisitDraft || !!reminderRenewalType}
              onChange={(e) => setVehicleId(e.target.value)}
              required
            >
              {allowedVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.status !== "active" ? tr(" · архив") : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {!state.vehicles.length &&
          type !== "vehicle" &&
          type !== "category" && (
            <div className="error-box">
              {tr("Сначала добавьте автомобиль в гараж.")}
            </div>
          )}
        {type === "vehicle" ? (
          <>
            <Field
              label={tr("Название автомобиля")}
              name="name"
              value={record?.name}
              required
              placeholder={tr("Например, Volvo XC60")}
            />
            <VehicleIdentityFields
              record={record}
              vehicles={state.vehicles}
              onDirty={() => setDirty(true)}
            />
            <div className="field-grid">
              <Field
                label={tr("Год выпуска")}
                name="year"
                type="number"
                value={record?.year}
              />
              <Field
                label={tr("Госномер")}
                name="plate"
                value={record?.plate}
                placeholder={tr("А777АА 777")}
              />
            </div>
            <Field
              label={
                dUnit === "mi"
                  ? tr("Пробег при покупке, ми")
                  : tr("Пробег при покупке, км")
              }
              name="purchase_odometer"
              type="number"
              step="1"
              value={record?.purchase_odometer || 0}
              required
            />
            <div className="field-grid">
              <Field
                label={tr("Дата покупки")}
                name="purchase_date"
                type="date"
                value={record?.purchase_date}
              />
              <Field
                label={purchasePriceLabel}
                name="purchase_amount"
                type="number"
                step="0.01"
                value={
                  record?.purchase_minor ? record.purchase_minor / 100 : ""
                }
              />
            </div>
            <label className="upload-zone">
              <Upload size={24} />
              <strong>
                {files.length
                  ? files[0].name
                  : tr("Фотография вашего автомобиля")}
              </strong>
              <span>{tr("JPEG, PNG, WebP · до 20 МБ")}</span>
              <small>
                {tr("Обложка будет видна всем участникам этого автомобиля.")}
              </small>
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseFiles}
              />
            </label>
            <details open={!!record}>
              <summary>
                {tr("Характеристики и владение")}
                <ChevronDown size={16} />
              </summary>
              <div className="field-grid">
                <Field
                  label={tr("Поколение")}
                  name="generation"
                  value={record?.generation}
                />
                <Field
                  label={tr("Комплектация")}
                  name="trim"
                  value={record?.trim}
                />
                <Field label="VIN" name="vin" value={record?.vin} />
                <Field
                  label={tr("Коробка передач")}
                  name="transmission"
                  value={record?.transmission}
                />
                <Field
                  label={tr("Привод")}
                  name="drive"
                  value={record?.drive}
                />
                <Field label={tr("Топливо")} name="fuel" value={record?.fuel} />
                <Field
                  label={tr("Валюта")}
                  name="currency"
                  value={record?.currency || defaultCurrency(state)}
                  list="currency-options"
                />
              </div>
              <Field label={tr("Статус")} name="status">
                <select name="status" defaultValue={record?.status || "active"}>
                  <option value="active">{tr("В гараже")}</option>
                  <option value="archived">{tr("В архиве")}</option>
                  <option value="sold">{tr("Продан")}</option>
                </select>
              </Field>
              <div className="field-grid">
                <Field
                  label={tr("Дата продажи")}
                  name="sale_date"
                  type="date"
                  value={record?.sale_date}
                />
                <Field
                  label={tr("Цена продажи")}
                  name="sale_amount"
                  type="number"
                  step="0.01"
                  value={record?.sale_minor ? record.sale_minor / 100 : ""}
                />
              </div>
              <Field label={tr("Заметки")} name="notes" value={record?.notes} />
            </details>
          </>
        ) : type === "category" ? (
          <>
            <Field
              label={tr("Название категории")}
              name="name"
              value={record?.name}
              required
            />
            <Field label={tr("Родительская категория")} name="parent_id">
              <select name="parent_id" defaultValue="">
                <option value="">{tr("Самостоятельная категория")}</option>
                {state.categories
                  .filter((c) => !c.parent_id && !c.deleted)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          </>
        ) : type === "document" ? (
          <>
            <Field label={tr("Название")} name="title" required />
            <Field label={tr("Тип документа")} name="document_type">
              <select name="document_type">
                {[
                  tr("СТС"),
                  tr("ПТС / ЭПТС"),
                  tr("ОСАГО"),
                  tr("КАСКО"),
                  tr("Договор"),
                  tr("Заказ-наряд"),
                  tr("Чек"),
                  tr("Диагностическая карта"),
                  tr("Фотография"),
                  tr("Прочее"),
                ].map((t) => (
                  <option key={t} value={t}>
                    {tr(t)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="field-grid">
              <Field label={tr("Дата выдачи")} name="issued" type="date" />
              <Field label={tr("Действует до")} name="expires" type="date" />
            </div>
            <Field label={tr("Связать с событием")} name="event_id">
              <select name="event_id" defaultValue={record?.event_id || ""}>
                <option value="">{tr("Документ автомобиля")}</option>
                {state.events
                  .filter((e) => e.vehicle_id === vehicleId && !e.deleted)
                  .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.occurred_at.slice(0, 10)} ·{" "}
                      {e.description || kindNames[e.kind]}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={tr("Заметка")} name="notes" />
            <label className="upload-zone">
              <Upload size={24} />
              <strong>{files[0]?.name || tr("Выберите файл")}</strong>
              <span>{tr("Изображение, PDF или другой файл · до 20 МБ")}</span>
              <input name="file" type="file" onChange={chooseFiles} required />
            </label>
          </>
        ) : type === "reminder" ? (
          <>
            <Field
              label={tr("Что нужно сделать")}
              name="title"
              value={record?.title ?? reminderDraft?.title}
              required
              placeholder={tr("Замена моторного масла")}
            />
            {reminderRenewalType ? (
              <>
                <div className="field-grid">
                  <Field
                    label={tr("К дате")}
                    name="due_date"
                    type="date"
                    value={record?.due_date ?? reminderDraft?.due_date}
                    readOnly
                  />
                  <Field
                    label={tr("Предупредить за, дней")}
                    name="warning_days"
                  >
                    <select
                      name="warning_days"
                      defaultValue={record?.renewal_schedule?.lead_days ?? 30}
                    >
                      {[7, 14, 30].map((days) => (
                        <option key={days} value={days}>
                          {days}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p className="field-help">
                  {tr("Срок обновится, когда появится новое продление.")}
                </p>
              </>
            ) : (
              <>
                <div className="field-grid">
                  <Field
                    label={tr("К дате")}
                    name="due_date"
                    type="date"
                    value={record?.due_date ?? reminderDraft?.due_date}
                  />
                  <Field
                    label={
                      dUnit === "mi"
                        ? tr("На пробеге, ми")
                        : tr("На пробеге, км")
                    }
                    name="due_odometer"
                    type="number"
                    step="1"
                    value={record?.due_odometer}
                  />
                </div>
                <p className="field-help">
                  {tr(
                    "Если заданы оба условия, напомним при наступлении любого.",
                  )}
                </p>
                <div className="field-grid">
                  <Field
                    label={tr("Предупредить за, дней")}
                    name="warning_days"
                    type="number"
                    value={record?.warning_days ?? 30}
                  />
                  <Field
                    label={
                      dUnit === "mi"
                        ? tr("Предупредить за, ми")
                        : tr("Предупредить за, км")
                    }
                    name="warning_km"
                    type="number"
                    value={record?.warning_km ?? 1000}
                  />
                  <Field
                    label={tr("Повтор каждые, дней")}
                    name="repeat_days"
                    type="number"
                    value={record?.repeat_days || 0}
                  />
                  <Field
                    label={
                      dUnit === "mi"
                        ? tr("Повтор каждые, ми")
                        : tr("Повтор каждые, км")
                    }
                    name="repeat_km"
                    type="number"
                    value={record?.repeat_km || 0}
                  />
                </div>
              </>
            )}
            <label className="check-field">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={record?.enabled ?? true}
              />
              {tr("Напоминание включено")}
            </label>
            <details
              className="advanced-fields"
              open={record?.estimated_cost_minor != null}
            >
              <summary>
                {tr("Плановая стоимость обслуживания ")}
                <ChevronDown size={16} />
              </summary>
              <p className="field-help">
                {tr(
                  "Необязательная оценка для плана. Пусто — стоимость неизвестна. Фактический расход вносится отдельно.",
                )}
              </p>
              <div className="field-grid">
                <Field
                  label={tr("Ориентировочная стоимость")}
                  name="estimated_cost"
                  type="number"
                  step="0.01"
                  value={
                    record?.estimated_cost_minor == null
                      ? ""
                      : record.estimated_cost_minor / 100
                  }
                />
                <Field
                  key={`cost-curr-${vehicleId}`}
                  label={tr("Валюта оценки")}
                  name="cost_currency"
                  value={
                    record?.cost_currency || defaultCurrency(state, vehicle)
                  }
                  list="currency-options"
                />
              </div>
            </details>
          </>
        ) : (
          <>
            {["fuel", "expense", "maintenance", "odometer"].includes(type) && (
              <OcrReview kind={type} vehicleId={vehicleId} onApply={applyOcr} />
            )}
            <div className="field-grid">
              <Field
                label={
                  renewalKind
                    ? "Дата оплаты"
                    : type === "fuel"
                      ? "Дата"
                      : "Дата и время"
                }
                name="occurred_at"
                type={type === "fuel" ? "date" : "datetime-local"}
                value={
                  type === "fuel"
                    ? record?.occurred_at?.slice(0, 10) || today(openedAt)
                    : renewalKind && record?.occurred_at?.length === 10
                      ? record.occurred_at + "T12:00"
                      : record?.occurred_at?.slice(0, 16) || today() + "T12:00"
                }
                required
              />
              {renewalKind ? (
                <Field
                  label="Действует до"
                  name="renewal_expires_on"
                  type="date"
                  value={renewal?.expires_on}
                  required
                />
              ) : (
                <Field
                  key={type === "fuel" ? vehicleId : undefined}
                  label={dUnit === "mi" ? tr("Пробег, ми") : tr("Пробег, км")}
                  name="odometer"
                  type="number"
                  step="1"
                  value={
                    (type !== "fuel" || record?.vehicle_id === vehicleId
                      ? record?.odometer
                      : undefined) ??
                    vehicle?.current_odometer ??
                    ""
                  }
                  required={type === "fuel" || type === "odometer"}
                />
              )}
            </div>
            {renewalKind === "registration" && (
              <Field label="Техосмотр" name="renewal_inspection">
                <select
                  name="renewal_inspection"
                  defaultValue={renewal?.inspection_status ?? "pending"}
                >
                  {Object.entries(inspectionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {tr(label)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {type === "fuel" ? (
              <>
                <div className="field-grid">
                  <Field label="Часы (24 ч)" name="occurred_hour">
                    <select
                      name="occurred_hour"
                      defaultValue={
                        record
                          ? record.occurred_at?.slice(11, 13) || "12"
                          : clockOptions[openedAt.getHours()]
                      }
                      required
                    >
                      {clockOptions.slice(0, 24).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Минуты" name="occurred_minute">
                    <select
                      name="occurred_minute"
                      defaultValue={
                        record
                          ? record.occurred_at?.slice(14, 16) || "00"
                          : clockOptions[openedAt.getMinutes()]
                      }
                      required
                    >
                      {clockOptions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="fuel-form-heading">
                  <Fuel size={21} />
                  <span>{tr("Любые два значения — третье рассчитаем")}</span>
                </div>
                <div className="field-grid three">
                  {(
                    [
                      ["liters", fuelVolumeLabel],
                      ["price", fuelPriceLabel],
                      ["amount", amountLabel],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {tr(label)}
                      <input
                        type="number"
                        min={
                          key === "amount"
                            ? "0.01"
                            : key === "price"
                              ? "0"
                              : "0.001"
                        }
                        step={
                          key === "price"
                            ? "any"
                            : key === "liters"
                              ? "0.001"
                              : "0.01"
                        }
                        inputMode="decimal"
                        value={fuelValues[key]}
                        placeholder={tr("Автоматически")}
                        onChange={(e) =>
                          setFuelValues((v) => ({
                            ...v,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <FuelDetailsFields
                  key={vehicleId}
                  record={record}
                  vehicle={vehicle}
                  events={state.events}
                  onDirty={() => setDirty(true)}
                />
                <label className="check-field">
                  <input
                    name="full"
                    type="checkbox"
                    defaultChecked={record?.full ?? false}
                  />
                  {tr("Полный бак")}
                </label>
                <label className="check-field">
                  <input
                    name="gap"
                    type="checkbox"
                    defaultChecked={record?.gap ?? false}
                  />
                  {tr("Перед этой записью была пропущенная заправка")}
                </label>
                <p className="field-help">
                  {tr(
                    "Пропуск прерывает расчёт расхода до следующего полного бака.",
                  )}
                </p>
                <details>
                  <summary>{tr("Записать по чеку или оплате")}</summary>
                  <p className="field-help">
                    {tr(
                      "Чек АЗС: перенесите литры и сумму, цену рассчитаем. Скрин оплаты: перенесите сумму, добавьте литры с колонки или чека. Пробег и полный бак подтвердите сами. Фото можно прикрепить ниже; оно останется на вашем сервере. Автоматического распознавания пока нет.",
                    )}
                  </p>
                </details>
              </>
            ) : type === "expense" || type === "maintenance" ? (
              <>
                {type === "maintenance" && vehicle?.can_edit !== false && (
                  <label>
                    {tr("Готовый шаблон")}
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const input = form.current?.elements.namedItem(
                          "description",
                        ) as HTMLInputElement;
                        if (input) input.value = e.target.value;
                        setDirty(true);
                      }}
                    >
                      <option value="">{tr("Выберите работу")}</option>
                      {maintenanceTemplates.map((t) => (
                        <option key={t} value={t}>
                          {tr(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="field-grid">
                  <Field
                    label={amountLabel}
                    name="amount"
                    type="number"
                    step="0.01"
                    value={record?.amount ?? ""}
                    required={!items.length}
                  />
                  <Field label={tr("Категория")} name="category">
                    <select
                      name="category"
                      defaultValue={
                        record?.category ||
                        (renewalKind === "insurance"
                          ? "Страхование"
                          : renewalKind === "registration"
                            ? "Налоги"
                            : type === "maintenance"
                              ? "Плановое ТО"
                              : "Прочее")
                      }
                    >
                      {allCategories.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            ) : null}
            <Field
              label={type === "note" ? tr("Ваша заметка") : tr("Описание")}
              name="description"
              value={record?.description}
              required={type === "note"}
              placeholder={
                type === "maintenance"
                  ? tr("Что сделали с автомобилем?")
                  : tr("Что важно сохранить?")
              }
            />
            {type === "maintenance" && (
              <>
                {serviceVisitDraft?.concernIds.length ? (
                  <p className="field-help">
                    {tr(
                      "После сохранения будут закрыты выбранные задачи для СТО.",
                    )}
                  </p>
                ) : null}
                <label>
                  {tr("Что проверить после визита")}
                  <textarea
                    name="service_visit_follow_up"
                    maxLength={1500}
                    defaultValue={record?.service_visit?.follow_up ?? ""}
                  />
                </label>
              </>
            )}
            {(type === "maintenance" || type === "expense") && (
              <details open={type === "maintenance" || !!items.length}>
                <summary>
                  {tr("Позиции, запчасти и работы")}
                  <ChevronDown size={16} />
                </summary>
                <p className="field-help">
                  {tr(
                    "Если есть позиции, итог рассчитывается из них, а не из поля «Сумма».",
                  )}
                </p>
                <div className="items-list">
                  {items.map((item, index) => (
                    <div className="item-editor" key={index}>
                      <div className="item-editor-title">
                        <span>
                          {tr("ПОЗИЦИЯ ")}
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={tr("Удалить позицию {0}", [index + 1])}
                          onClick={() =>
                            setItems((v) => v.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <label>
                        {tr("Название")}
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(index, "name", e.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        {tr("Артикул")}
                        <input
                          value={item.part_number}
                          onChange={(e) =>
                            updateItem(index, "part_number", e.target.value)
                          }
                        />
                      </label>
                      <div className="field-grid three">
                        {(
                          [
                            ["quantity", tr("Кол-во")],
                            ["unit_price", unitPriceLabel],
                            ["discount", discountLabel],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {tr(label)}
                            <input
                              type="number"
                              step="0.01"
                              min={key === "quantity" ? "0.01" : "0"}
                              required
                              value={item[key]}
                              onChange={(e) =>
                                updateItem(index, key, e.target.value)
                              }
                            />
                          </label>
                        ))}
                      </div>
                      {item.amount_minor != null && (
                        <small>
                          {tr("Сохранённый итог: ")}
                          {money(item.amount_minor, activeCurrency)}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="full"
                  onClick={() =>
                    setItems((v) => [
                      ...v,
                      {
                        name: "",
                        part_number: "",
                        quantity: "1",
                        unit_price: "0",
                        discount: "0",
                      },
                    ])
                  }
                >
                  <Plus size={17} />
                  {tr("Добавить позицию")}
                </Button>
                <Field
                  label={adjustmentLabel}
                  name="adjustment"
                  type="number"
                  step="0.01"
                  value={record?.adjustment || "0"}
                />
              </details>
            )}
            <details>
              <summary>
                {tr("Дополнительные поля")}
                <ChevronDown size={16} />
              </summary>
              <div className="field-grid">
                <Field
                  label={tr("Сервис / продавец")}
                  name="vendor"
                  value={record?.vendor}
                />
                <Field
                  label={tr("Адрес сервиса")}
                  name="service_address"
                  value={record?.service_address}
                />
                <Field
                  label={tr("Широта сервиса")}
                  name="service_latitude"
                  type="number"
                  step="any"
                  value={record?.service_latitude}
                />
                <Field
                  label={tr("Долгота сервиса")}
                  name="service_longitude"
                  type="number"
                  step="any"
                  value={record?.service_longitude}
                />
                <Field
                  label={tr("Способ оплаты")}
                  name="payment"
                  value={record?.payment}
                />
                <Field label={tr("Теги")} name="tags" value={record?.tags} />
                {renewalKind && record?.odometer != null && (
                  <input
                    type="hidden"
                    name="odometer"
                    value={record.odometer}
                  />
                )}
                <Field
                  key={`curr-${vehicleId}`}
                  label={tr("Валюта")}
                  name="currency"
                  value={record?.currency || defaultCurrency(state, vehicle)}
                  list="currency-options"
                />
              </div>
              <p className="field-help">
                {tr(
                  "Адрес хранится локально. Координаты необязательны: добавьте их парой для просмотра карты. Геокодирование не выполняется.",
                )}
              </p>
              <label className="check-field warning-text">
                <input
                  type="checkbox"
                  name="odometer_confirmed"
                  defaultChecked={false}
                />
                <span>
                  {tr(
                    "Я проверил пробег и подтверждаю исправление, даже если оно нарушает хронологию",
                  )}
                </span>
              </label>
              {type === "maintenance" && vehicle?.can_edit !== false && (
                <Field
                  label={tr("Выполнить и обновить напоминание")}
                  name="next_reminder"
                >
                  <select name="next_reminder">
                    <option value="">{tr("Не изменять")}</option>
                    {state.reminders
                      .filter(
                        (r) =>
                          r.vehicle_id === vehicleId &&
                          !r.renewal_schedule &&
                          r.enabled &&
                          r.can_edit !== false,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </details>
            <label className="file-attach">
              <Upload size={17} />
              <span>
                {files.length
                  ? files.map((f) => f.name).join(", ")
                  : tr(
                      renewalKind === "registration"
                        ? "Прикрепить документ или отчёт техосмотра"
                        : renewalKind === "insurance"
                          ? "Прикрепить страховой полис"
                          : "Прикрепить чек, фото или заказ-наряд",
                    )}
              </span>
              <input name="file" type="file" multiple onChange={chooseFiles} />
            </label>
            <small className="muted">
              {tr("Вложения загружаются при подключении к серверу.")}
            </small>
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={16} />
            <span>{tr(error)}</span>
          </div>
        )}
        <div className="form-footer">
          <Button variant="outline" type="button" onClick={close}>
            {tr("Отмена")}
          </Button>
          <Button
            type="submit"
            disabled={
              busy || (!vehicleId && type !== "vehicle" && type !== "category")
            }
          >
            {busy
              ? tr("Сохраняем…")
              : saved
                ? tr("Повторить сохранение")
                : tr("Сохранить")}
            {!busy && <Check size={17} />}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
