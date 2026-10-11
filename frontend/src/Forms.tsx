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
      {label}
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
  const [vehicleId, setVehicleId] = useState(
    record?.vehicle_id || selected || state.vehicles[0]?.id || "",
  );
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
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
        ? "Профиль автомобиля"
        : "Новый автомобиль"
      : type === "document"
        ? "Добавить документ"
        : type === "reminder"
          ? record
            ? "Настроить напоминание"
            : "Новое напоминание"
          : type === "category"
            ? "Новая категория"
            : `${record ? "Редактировать · " : ""}${kindNames[type]}`;
  function close() {
    if (dirty && !confirm("Закрыть форму и потерять несохранённые изменения?"))
      return;
    onClose();
  }
  function chooseFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    if (list.some((f) => f.size > 20 * 1024 * 1024)) {
      setError("Каждый файл должен быть меньше 20 МБ");
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
        if (!files.length) throw new Error("Выберите документ для загрузки");
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
        const result = await save(entity, data, saved || record);
        setSaved(result);
        if (files.length) {
          if (result.pending)
            throw new Error(
              "Запись сохранена офлайн. Файлы выберите и загрузите после синхронизации.",
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
                  data.odometer || vehicle?.current_odometer || 0,
              },
              reminder,
              "complete",
            );
        }
      }
      setDirty(false);
      notify(record ? "Изменения сохранены" : "Готово. История стала полнее.");
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
  return (
    <Sheet open onClose={close} title={title} wide={type === "vehicle"}>
      <form
        ref={form}
        className="record-form"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        {type !== "vehicle" && type !== "category" && (
          <label>
            Автомобиль
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
            >
              {state.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.status !== "active" ? " · архив" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {!state.vehicles.length &&
          type !== "vehicle" &&
          type !== "category" && (
            <div className="error-box">
              Сначала добавьте автомобиль в гараж.
            </div>
          )}
        {type === "vehicle" ? (
          <>
            <Field
              label="Название автомобиля"
              name="name"
              value={record?.name}
              required
              placeholder="Например, Volvo XC60"
            />
            <div className="field-grid">
              <Field label="Марка" name="brand" value={record?.brand} />
              <Field label="Модель" name="model" value={record?.model} />
              <Field
                label="Год выпуска"
                name="year"
                type="number"
                value={record?.year}
              />
              <Field
                label="Госномер"
                name="plate"
                value={record?.plate}
                placeholder="А777АА 777"
              />
            </div>
            <Field
              label="Пробег при покупке, км"
              name="purchase_odometer"
              type="number"
              step="1"
              value={record?.purchase_odometer || 0}
              required
            />
            <div className="field-grid">
              <Field
                label="Дата покупки"
                name="purchase_date"
                type="date"
                value={record?.purchase_date}
              />
              <Field
                label="Цена покупки, ₽"
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
                {files.length ? files[0].name : "Фотография вашего автомобиля"}
              </strong>
              <span>JPEG, PNG, WebP · до 20 МБ</span>
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseFiles}
              />
            </label>
            <details open={!!record}>
              <summary>
                Характеристики и владение
                <ChevronDown size={16} />
              </summary>
              <div className="field-grid">
                <Field
                  label="Поколение"
                  name="generation"
                  value={record?.generation}
                />
                <Field label="Комплектация" name="trim" value={record?.trim} />
                <Field label="VIN" name="vin" value={record?.vin} />
                <Field label="Двигатель" name="engine" value={record?.engine} />
                <Field
                  label="Коробка передач"
                  name="transmission"
                  value={record?.transmission}
                />
                <Field label="Привод" name="drive" value={record?.drive} />
                <Field label="Топливо" name="fuel" value={record?.fuel} />
                <Field
                  label="Валюта"
                  name="currency"
                  value={record?.currency || "RUB"}
                />
              </div>
              <Field label="Статус" name="status">
                <select name="status" defaultValue={record?.status || "active"}>
                  <option value="active">В гараже</option>
                  <option value="archived">В архиве</option>
                  <option value="sold">Продан</option>
                </select>
              </Field>
              <div className="field-grid">
                <Field
                  label="Дата продажи"
                  name="sale_date"
                  type="date"
                  value={record?.sale_date}
                />
                <Field
                  label="Цена продажи"
                  name="sale_amount"
                  type="number"
                  step="0.01"
                  value={record?.sale_minor ? record.sale_minor / 100 : ""}
                />
              </div>
              <Field label="Заметки" name="notes" value={record?.notes} />
            </details>
          </>
        ) : type === "category" ? (
          <>
            <Field
              label="Название категории"
              name="name"
              value={record?.name}
              required
            />
            <Field label="Родительская категория" name="parent_id">
              <select name="parent_id" defaultValue="">
                <option value="">Самостоятельная категория</option>
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
            <Field label="Название" name="title" required />
            <Field label="Тип документа" name="document_type">
              <select name="document_type">
                {[
                  "СТС",
                  "ПТС / ЭПТС",
                  "ОСАГО",
                  "КАСКО",
                  "Договор",
                  "Заказ-наряд",
                  "Чек",
                  "Диагностическая карта",
                  "Фотография",
                  "Прочее",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="field-grid">
              <Field label="Дата выдачи" name="issued" type="date" />
              <Field label="Действует до" name="expires" type="date" />
            </div>
            <Field label="Связать с событием" name="event_id">
              <select name="event_id" defaultValue={record?.event_id || ""}>
                <option value="">Документ автомобиля</option>
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
            <Field label="Заметка" name="notes" />
            <label className="upload-zone">
              <Upload size={24} />
              <strong>{files[0]?.name || "Выберите файл"}</strong>
              <span>Изображение, PDF или другой файл · до 20 МБ</span>
              <input name="file" type="file" onChange={chooseFiles} required />
            </label>
          </>
        ) : type === "reminder" ? (
          <>
            <Field
              label="Что нужно сделать"
              name="title"
              value={record?.title}
              required
              placeholder="Замена моторного масла"
            />
            <div className="field-grid">
              <Field
                label="К дате"
                name="due_date"
                type="date"
                value={record?.due_date}
              />
              <Field
                label="На пробеге, км"
                name="due_odometer"
                type="number"
                step="1"
                value={record?.due_odometer}
              />
            </div>
            <p className="field-help">
              Если заданы оба условия, напомним при наступлении любого.
            </p>
            <div className="field-grid">
              <Field
                label="Предупредить за, дней"
                name="warning_days"
                type="number"
                value={record?.warning_days ?? 30}
              />
              <Field
                label="Предупредить за, км"
                name="warning_km"
                type="number"
                value={record?.warning_km ?? 1000}
              />
              <Field
                label="Повтор каждые, дней"
                name="repeat_days"
                type="number"
                value={record?.repeat_days || 0}
              />
              <Field
                label="Повтор каждые, км"
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
              Напоминание включено
            </label>
          </>
        ) : (
          <>
            <div className="field-grid">
              <Field
                label="Дата и время"
                name="occurred_at"
                type="datetime-local"
                value={record?.occurred_at?.slice(0, 16) || today() + "T12:00"}
                required
              />
              <Field
                label="Пробег, км"
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
                  <span>Любые два значения — третье рассчитаем</span>
                </div>
                <div className="field-grid three">
                  {(
                    [
                      ["liters", "Литры"],
                      ["price", "Цена за литр, ₽"],
                      ["amount", "Сумма, ₽"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min="0.001"
                        step={key === "liters" ? "0.001" : "0.01"}
                        inputMode="decimal"
                        value={fuelValues[key]}
                        placeholder="Автоматически"
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
                    label="Топливо"
                    name="fuel"
                    value={record?.fuel || vehicle?.fuel || "АИ-95"}
                  />
                  <Field label="АЗС" name="station" value={record?.station} />
                </div>
                <label className="check-field">
                  <input
                    name="full"
                    type="checkbox"
                    defaultChecked={record?.full ?? true}
                  />
                  Полный бак
                </label>
                <label className="check-field">
                  <input
                    name="gap"
                    type="checkbox"
                    defaultChecked={record?.gap ?? false}
                  />
                  Перед этой записью была пропущенная заправка
                </label>
                <p className="field-help">
                  Пропуск прерывает расчёт расхода до следующего полного бака.
                </p>
              </>
            ) : type === "expense" || type === "maintenance" ? (
              <>
                {type === "maintenance" && (
                  <label>
                    Готовый шаблон
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
                      <option value="">Выберите работу</option>
                      {maintenanceTemplates.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="field-grid">
                  <Field
                    label="Сумма, ₽"
                    name="amount"
                    type="number"
                    step="0.01"
                    value={record?.amount || ""}
                    required={!items.length}
                  />
                  <Field label="Категория" name="category">
                    <select
                      name="category"
                      defaultValue={
                        record?.category ||
                        (type === "maintenance" ? "Плановое ТО" : "Прочее")
                      }
                    >
                      {allCategories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            ) : null}
            <Field
              label={type === "note" ? "Ваша заметка" : "Описание"}
              name="description"
              value={record?.description}
              required={type === "note"}
              placeholder={
                type === "maintenance"
                  ? "Что сделали с автомобилем?"
                  : "Что важно сохранить?"
              }
            />
            {(type === "maintenance" || type === "expense") && (
              <details open={type === "maintenance" || !!items.length}>
                <summary>
                  Позиции, запчасти и работы
                  <ChevronDown size={16} />
                </summary>
                <p className="field-help">
                  Если есть позиции, итог рассчитывается из них, а не из поля
                  «Сумма».
                </p>
                <div className="items-list">
                  {items.map((item, index) => (
                    <div className="item-editor" key={index}>
                      <div className="item-editor-title">
                        <span>ПОЗИЦИЯ {index + 1}</span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Удалить позицию ${index + 1}`}
                          onClick={() =>
                            setItems((v) => v.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <label>
                        Название
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(index, "name", e.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Артикул
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
                            ["quantity", "Кол-во"],
                            ["unit_price", "Цена, ₽"],
                            ["discount", "Скидка, ₽"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {label}
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
                          Сохранённый итог: {money(item.amount_minor)}
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
                  Добавить позицию
                </Button>
                <Field
                  label="Корректировка итога, ₽ (можно отрицательную)"
                  name="adjustment"
                  type="number"
                  step="0.01"
                  value={record?.adjustment || "0"}
                />
              </details>
            )}
            <details>
              <summary>
                Дополнительные поля
                <ChevronDown size={16} />
              </summary>
              <div className="field-grid">
                <Field
                  label="Сервис / продавец"
                  name="vendor"
                  value={record?.vendor}
                />
                <Field
                  label="Способ оплаты"
                  name="payment"
                  value={record?.payment}
                />
                <Field label="Теги" name="tags" value={record?.tags} />
                <Field
                  label="Валюта"
                  name="currency"
                  value={record?.currency || "RUB"}
                />
              </div>
              <label className="check-field warning-text">
                <input
                  type="checkbox"
                  name="odometer_confirmed"
                  defaultChecked={false}
                />
                <span>
                  Я проверил пробег и подтверждаю исправление, даже если оно
                  нарушает хронологию
                </span>
              </label>
              {type === "maintenance" && (
                <Field
                  label="Выполнить и обновить напоминание"
                  name="next_reminder"
                >
                  <select name="next_reminder">
                    <option value="">Не изменять</option>
                    {state.reminders
                      .filter((r) => r.vehicle_id === vehicleId && r.enabled)
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
                  : "Прикрепить чек, фото или заказ-наряд"}
              </span>
              <input name="file" type="file" multiple onChange={chooseFiles} />
            </label>
            <small className="muted">
              Вложения загружаются при подключении к серверу.
            </small>
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="form-footer">
          <Button variant="outline" type="button" onClick={close}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={
              busy || (!vehicleId && type !== "vehicle" && type !== "category")
            }
          >
            {busy ? "Сохраняем…" : saved ? "Повторить сохранение" : "Сохранить"}
            {!busy && <Check size={17} />}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
