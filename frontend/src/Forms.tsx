import { categoryLabel } from "./utils";
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
import { useApp } from "./context";
import type { Item, Kind, RecordBase } from "./types";
import { categories, kindNames, money, today } from "./utils";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { OcrReview, type OcrFields } from "./OcrReview";

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
function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  placeholder = "",
  step,
  children,
}: {
  label: string;
  name: string;
  value?: any;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
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
}: {
  type: Kind | "vehicle" | "reminder" | "document" | "category";
  record?: RecordBase;
  onClose: () => void;
}) {
  const { state, selected, save, upload, notify, refresh } = useApp();
  const allowedVehicles = state.vehicles.filter(
    (v) => !["reminder", "document"].includes(type) || v.can_edit !== false,
  );
  const [vehicleId, setVehicleId] = useState(
    record?.vehicle_id ||
      allowedVehicles.find((v) => v.id === selected)?.id ||
      allowedVehicles[0]?.id ||
      "",
  );
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const lastFuel = state.events
    .filter(
      (e) => !e.deleted && e.kind === "fuel" && e.vehicle_id === vehicleId,
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<RecordBase | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<Item[]>(record?.items || []);
  const [fuelValues, setFuelValues] = useState({
    liters: record?.liters || "",
    price: record?.price || "",
    amount: record?.amount || "",
  });
  const form = useRef<HTMLFormElement>(null);
  const title =
    type === "vehicle"
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
          if (type === "fuel") Object.assign(data, fuelValues);
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
              document_type:
                type === "maintenance"
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
  function applyOcr(fields: OcrFields, source?: File) {
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
        input.value = name === "occurred_at" ? value + "T12:00" : value;
    }
    if (type === "fuel")
      setFuelValues((current) => ({
        ...current,
        ...(fields.amount === undefined ? {} : { amount: fields.amount }),
        ...(fields.liters === undefined ? {} : { liters: fields.liters }),
        ...(fields.price === undefined ? {} : { price: fields.price }),
      }));
    if (source) setFiles((current) => [...current, source]);
    setDirty(true);
  }
  return (
    <Sheet open onClose={close} title={tr(title)} wide={type === "vehicle"}>
      <form
        ref={form}
        className="record-form"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        {type !== "vehicle" && type !== "category" && (
          <label>
            {tr("Автомобиль")}
            <select
              value={vehicleId}
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
            <div className="field-grid">
              <Field label={tr("Марка")} name="brand" value={record?.brand} />
              <Field label={tr("Модель")} name="model" value={record?.model} />
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
              label={tr("Пробег при покупке, км")}
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
                label={tr("Цена покупки, ₽")}
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
                  label={tr("Двигатель")}
                  name="engine"
                  value={record?.engine}
                />
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
                  value={record?.currency || "RUB"}
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
              value={record?.title}
              required
              placeholder={tr("Замена моторного масла")}
            />
            <div className="field-grid">
              <Field
                label={tr("К дате")}
                name="due_date"
                type="date"
                value={record?.due_date}
              />
              <Field
                label={tr("На пробеге, км")}
                name="due_odometer"
                type="number"
                step="1"
                value={record?.due_odometer}
              />
            </div>
            <p className="field-help">
              {tr("Если заданы оба условия, напомним при наступлении любого.")}
            </p>
            <div className="field-grid">
              <Field
                label={tr("Предупредить за, дней")}
                name="warning_days"
                type="number"
                value={record?.warning_days ?? 30}
              />
              <Field
                label={tr("Предупредить за, км")}
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
                label={tr("Повтор каждые, км")}
                name="repeat_km"
                type="number"
                value={record?.repeat_km || 0}
              />
            </div>
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
                  label={tr("Валюта оценки")}
                  name="cost_currency"
                  value={record?.cost_currency || vehicle?.currency || "RUB"}
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
                label={tr("Дата и время")}
                name="occurred_at"
                type="datetime-local"
                value={record?.occurred_at?.slice(0, 16) || today() + "T12:00"}
                required
              />
              <Field
                label={tr("Пробег, км")}
                name="odometer"
                type="number"
                step="1"
                value={record?.odometer ?? vehicle?.current_odometer ?? ""}
                required={type === "fuel" || type === "odometer"}
              />
            </div>
            {type === "fuel" ? (
              <>
                <div className="fuel-form-heading">
                  <Fuel size={21} />
                  <span>{tr("Любые два значения — третье рассчитаем")}</span>
                </div>
                <div className="field-grid three">
                  {(
                    [
                      ["liters", tr("Литры")],
                      ["price", tr("Цена за литр, ₽")],
                      ["amount", tr("Сумма, ₽")],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {tr(label)}
                      <input
                        type="number"
                        min={key === "liters" ? "0.001" : "0.01"}
                        step={key === "liters" ? "0.001" : "0.01"}
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
                <div className="field-grid">
                  <Field
                    key={`fuel-${vehicleId}`}
                    label={tr("Топливо")}
                    name="fuel"
                    value={
                      record?.fuel || lastFuel?.fuel || vehicle?.fuel || "АИ-95"
                    }
                  />
                  <Field
                    key={`station-${vehicleId}`}
                    label={tr("АЗС")}
                    name="station"
                    value={record?.station ?? lastFuel?.station}
                  />
                </div>
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
                    label={tr("Сумма, ₽")}
                    name="amount"
                    type="number"
                    step="0.01"
                    value={record?.amount || ""}
                    required={!items.length}
                  />
                  <Field label={tr("Категория")} name="category">
                    <select
                      name="category"
                      defaultValue={
                        record?.category ||
                        (type === "maintenance" ? "Плановое ТО" : "Прочее")
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
                            ["unit_price", tr("Цена, ₽")],
                            ["discount", tr("Скидка, ₽")],
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
                          {money(item.amount_minor)}
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
                  label={tr("Корректировка итога, ₽ (можно отрицательную)")}
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
                <Field
                  label={tr("Валюта")}
                  name="currency"
                  value={record?.currency || "RUB"}
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
                  : tr("Прикрепить чек, фото или заказ-наряд")}
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
