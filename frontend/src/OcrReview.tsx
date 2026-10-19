import { useEffect, useRef, useState } from "react";
import { ScanText } from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import { tr } from "./i18n";
import { Button } from "./components/ui/button";
import type { Item } from "./types";

type Mode = "receipt" | "service" | "odometer" | "screenshot";
export type OcrFields = Partial<
  Record<
    "amount" | "liters" | "price" | "odometer" | "occurred_at" | "description",
    string
  >
>;
type Result = {
  text: string;
  fields: OcrFields;
  engine: string;
  items?: Item[];
  candidates?: Partial<Record<keyof OcrFields, string[]>>;
  alternatives?: string[];
};

export function OcrReview({
  kind,
  vehicleId,
  onApply,
}: {
  kind: string;
  vehicleId: string;
  onApply: (fields: OcrFields, source?: File, items?: Item[]) => void;
}) {
  const { session } = useApp();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(
    kind === "fuel"
      ? "receipt"
      : kind === "odometer"
        ? "odometer"
        : kind === "maintenance"
          ? "service"
          : "screenshot",
  );
  const [file, setFile] = useState<File>();
  const [page, setPage] = useState("1");
  const [pages, setPages] = useState("");
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState([0, 0, 100, 100]);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [lineItems, setLineItems] = useState<Item[]>([]);
  const [chosenItems, setChosenItems] = useState<Record<number, boolean>>({});
  const preview = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<Result>();
  const [values, setValues] = useState<OcrFields>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !preview.current) return;
      const canvas = preview.current;
      const sideways = rotation === 90 || rotation === 270;
      const width = sideways ? image.height : image.width;
      const height = sideways ? image.width : image.height;
      const scale = Math.min(1, 600 / Math.max(width, height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(
        image,
        (-image.width * scale) / 2,
        (-image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
      context.resetTransform();
      if (cropEnabled) {
        context.strokeStyle = "#84cc16";
        context.lineWidth = 3;
        context.strokeRect(
          (crop[0] * canvas.width) / 100,
          (crop[1] * canvas.height) / 100,
          (crop[2] * canvas.width) / 100,
          (crop[3] * canvas.height) / 100,
        );
      }
    };
    image.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file, rotation, cropEnabled, crop]);
  useEffect(() => () => controller.current?.abort(), []);
  // A suggestion from one vehicle must never be applied to another vehicle's draft.
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
    setValues({});
    setSelected({});
    setBusy(false);
    setError("");
  }, [vehicleId]);
  const labels: Record<keyof OcrFields, string> = {
    amount: tr("Сумма, ₽"),
    liters: tr("Литры"),
    price: tr("Цена за литр, ₽"),
    odometer: tr("Пробег, км"),
    occurred_at: tr("Дата"),
    description: tr("Описание"),
  };
  const keys: (keyof OcrFields)[] =
    kind === "odometer"
      ? ["odometer"]
      : mode === "odometer"
        ? ["odometer"]
        : kind === "fuel"
          ? [
              "occurred_at",
              "amount",
              "liters",
              "price",
              "odometer",
              "description",
            ]
          : ["occurred_at", "amount", "odometer", "description"];
  function reset(clearSource = false) {
    controller.current?.abort();
    setResult(undefined);
    setValues({});
    setSelected({});
    setBusy(false);
    setError("");
    setAttach(false);
    setLineItems([]);
    setChosenItems({});
    if (clearSource) setFile(undefined);
  }
  async function recognize() {
    if (!file || !vehicleId) return;
    if (!navigator.onLine) {
      setError(
        tr(
          "Для OCR подключитесь к своему серверу. Ручной ввод работает офлайн.",
        ),
      );
      return;
    }
    if (file.size > 20 * 1024 * 1024 || !file.size) {
      setError(tr("Файл должен быть от 1 байта до 20 МБ"));
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setResult(undefined);
    const body = new FormData();
    body.append("file", file);
    body.append("vehicle_id", vehicleId);
    body.append("mode", mode);
    body.append("page", page);
    if (pages.trim()) body.append("pages", pages.trim());
    body.append("rotation", String(rotation));
    if (cropEnabled)
      body.append("crop", JSON.stringify(crop.map((v) => v / 100)));
    try {
      const data = await api<Result>(
        "/ocr",
        { method: "POST", body, signal: abort.signal },
        session.csrf,
      );
      if (abort.signal.aborted) return;
      setResult(data);
      setValues(data.fields);
      setSelected({});
      setLineItems(data.items || []);
      setChosenItems({});
    } catch (error) {
      if (!abort.signal.aborted) setError(tr((error as Error).message));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function apply() {
    try {
      const fields = Object.fromEntries(
        keys
          .filter((key) => selected[key] && values[key]?.trim())
          .map((key) => [key, values[key]!.trim()]),
      );
      const pickedItems =
        kind === "maintenance"
          ? lineItems.filter((_, i) => chosenItems[i])
          : [];
      if (pickedItems.length && fields.amount)
        throw new Error(
          tr("Выберите позиции или итоговую сумму, не оба варианта"),
        );
      if (!Object.keys(fields).length && !pickedItems.length) {
        setError(tr("Выберите проверенные поля для переноса"));
        return;
      }
      for (const key of ["amount", "liters", "price", "odometer"]) {
        if (fields[key] === undefined) continue;
        const value = fields[key].replace(",", ".");
        const valid =
          key === "odometer"
            ? /^\d{1,7}$/.test(value) && Number(value) <= 3000000
            : /^\d{1,10}(?:\.\d{1,6})?$/.test(value) &&
              Number(value) > 0 &&
              (key !== "amount" || /^\d{1,10}(?:\.\d{1,2})?$/.test(value));
        if (!valid)
          throw new Error(
            tr("Проверьте числовое поле: {0}", [
              labels[key as keyof OcrFields],
            ]),
          );
        fields[key] = value;
      }
      onApply(fields, attach ? file : undefined, pickedItems);
      reset(true);
      setOpen(false);
    } catch (error) {
      setError(tr((error as Error).message));
    }
  }
  return (
    <section className="ocr-review">
      <Button
        variant="outline"
        type="button"
        onClick={() => {
          if (open) reset(true);
          setOpen(!open);
        }}
      >
        <ScanText size={18} />
        {tr("Распознать фото или PDF")}
      </Button>
      {open && (
        <div className="ocr-content">
          <h3>{tr("Локальное распознавание")}</h3>
          <p className="field-help">
            {tr(
              "Файл обрабатывается только на вашем сервере. OCR может ошибаться. Выберите и проверьте поля — запись сохранится обычной кнопкой «Сохранить».",
            )}
          </p>
          <label>
            {tr("Источник распознавания")}
            <select
              aria-label={tr("Источник распознавания")}
              value={mode}
              disabled={busy}
              onChange={(e) => {
                reset();
                setMode(e.target.value as Mode);
              }}
            >
              <option value="receipt">{tr("Чек АЗС")}</option>
              <option value="service">{tr("Счёт или заказ-наряд")}</option>
              <option value="odometer">{tr("Фото приборки")}</option>
              <option value="screenshot">
                {tr("Любой скриншот или документ")}
              </option>
            </select>
          </label>
          <label>
            {tr("Фото, скриншот или PDF")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy}
              onChange={(e) => {
                reset();
                setFile(e.target.files?.[0]);
                setPage("1");
                setPages("");
                setRotation(0);
                setCropEnabled(false);
                setCrop([0, 0, 100, 100]);
              }}
            />
          </label>
          {file?.type === "application/pdf" && (
            <label>
              {tr("Страница PDF")}
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={page}
                disabled={busy}
                onChange={(e) => {
                  reset();
                  setPage(e.target.value);
                }}
              />
            </label>
          )}
          {file?.type === "application/pdf" && (
            <label>
              {tr("Страницы PDF через запятую (до трёх)")}
              <input
                value={pages}
                placeholder="1,2,3"
                disabled={busy}
                onChange={(e) => {
                  reset();
                  setPages(e.target.value);
                }}
              />
            </label>
          )}
          {file && (
            <details className="ocr-preprocessing">
              <summary>{tr("Обрезка и поворот")}</summary>
              <label>
                {tr("Поворот по часовой стрелке")}
                <select
                  value={rotation}
                  aria-label={tr("Поворот по часовой стрелке")}
                  disabled={busy}
                  onChange={(e) => {
                    reset();
                    setRotation(Number(e.target.value));
                  }}
                >
                  {[0, 90, 180, 270].map((value) => (
                    <option key={value} value={value}>
                      {value}°
                    </option>
                  ))}
                </select>
              </label>
              {file.type.startsWith("image/") && (
                <canvas
                  ref={preview}
                  className="ocr-preview"
                  aria-label={tr("Предпросмотр обрезки")}
                />
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={cropEnabled}
                  disabled={busy}
                  onChange={(e) => {
                    reset();
                    setCropEnabled(e.target.checked);
                  }}
                />
                {tr("Обрезать после поворота")}
              </label>
              {cropEnabled && (
                <div className="field-grid">
                  {["Слева, %", "Сверху, %", "Ширина, %", "Высота, %"].map(
                    (label, i) => (
                      <label key={label}>
                        {tr(label)}
                        <input
                          type="number"
                          min={i < 2 ? 0 : 1}
                          max="100"
                          value={crop[i]}
                          disabled={busy}
                          onChange={(e) => {
                            reset();
                            setCrop((v) =>
                              v.map((n, j) =>
                                i === j ? Number(e.target.value) : n,
                              ),
                            );
                          }}
                        />
                      </label>
                    ),
                  )}
                </div>
              )}
              <p className="field-help">
                {tr(
                  "Преобразования применяются ко всем выбранным страницам. Исходный файл не меняется.",
                )}
              </p>
            </details>
          )}
          <Button
            type="button"
            disabled={busy || !file || !vehicleId}
            onClick={() => void recognize()}
          >
            {busy ? tr("Распознаём на сервере…") : tr("Распознать локально")}
          </Button>
          {busy && (
            <p role="status">
              {tr("Обычно это занимает несколько секунд. Предел — 45 секунд.")}
            </p>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {result && (
            <>
              <label>
                {tr("Распознанный текст")}
                <textarea
                  aria-label={tr("Распознанный текст")}
                  value={result.text}
                  readOnly
                  rows={7}
                />
              </label>
              <p className="field-help">
                {tr(
                  "Неподписанные и неоднозначные числа не подставляются. Для фото приборки проверьте, что это одометр в километрах, а не поездка, запас хода или мили.",
                )}
              </p>
              {!!result.alternatives?.length && (
                <details>
                  <summary>{tr("Другие варианты текста")}</summary>
                  {Array.from(new Set(result.alternatives))
                    .filter((text) => text !== result.text)
                    .map((text, index) => (
                      <textarea
                        key={index}
                        aria-label={tr("Вариант текста {0}", [index + 1])}
                        value={text}
                        readOnly
                        rows={7}
                      />
                    ))}
                </details>
              )}
              <div className="ocr-fields">
                {keys.map((key) => (
                  <div className="ocr-field" key={key}>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={!!selected[key]}
                        onChange={(e) =>
                          setSelected((current) => ({
                            ...current,
                            [key]: e.target.checked,
                          }))
                        }
                      />
                      {tr("Перенести {0}", [labels[key]])}
                    </label>
                    {!!result.candidates?.[key]?.length && (
                      <label>
                        {tr("Варианты распознавания")}
                        <select
                          aria-label={
                            tr("Варианты распознавания") + ": " + labels[key]
                          }
                          value=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value)
                              setValues((current) => ({
                                ...current,
                                [key]: value,
                              }));
                          }}
                        >
                          <option value="">
                            {tr("Выберите после проверки")}
                          </option>
                          {result.candidates[key]!.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      <span className="sr-only">
                        {tr("Проверенное поле: {0}", [labels[key]])}
                      </span>
                      <input
                        type={key === "occurred_at" ? "date" : "text"}
                        inputMode={
                          ["amount", "liters", "price", "odometer"].includes(
                            key,
                          )
                            ? "decimal"
                            : undefined
                        }
                        value={values[key] || ""}
                        maxLength={key === "description" ? 4000 : 32}
                        placeholder={tr("Не найдено — можно ввести вручную")}
                        onChange={(e) =>
                          setValues((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
              {kind === "maintenance" && lineItems.length > 0 && (
                <section className="ocr-line-items">
                  <h4>{tr("Проверьте позиции заказ-наряда")}</h4>
                  <p className="field-help">
                    {tr(
                      "Выберите только проверенные строки. Итог будет рассчитан из выбранных позиций.",
                    )}
                  </p>
                  <p className="field-help">
                    {tr(
                      "Налоги включены в цену; скидка указана суммой за строку.",
                    )}
                  </p>
                  {lineItems.map((item, index) => (
                    <div key={index} className="ocr-line-item">
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={!!chosenItems[index]}
                          onChange={(e) =>
                            setChosenItems((v) => ({
                              ...v,
                              [index]: e.target.checked,
                            }))
                          }
                        />
                        {tr("Перенести позицию {0}", [index + 1])}
                      </label>
                      {(
                        [
                          "name",
                          "part_number",
                          "quantity",
                          "unit_price",
                          "discount",
                        ] as const
                      ).map((key) => (
                        <label key={key}>
                          {tr(
                            {
                              name: "Название",
                              part_number: "Артикул",
                              quantity: "Кол-во",
                              unit_price: "Цена, ₽",
                              discount: "Скидка, ₽",
                            }[key],
                          )}
                          <input
                            value={item[key]}
                            maxLength={key === "name" ? 200 : 100}
                            onChange={(e) =>
                              setLineItems((v) =>
                                v.map((row, i) =>
                                  i === index
                                    ? { ...row, [key]: e.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </section>
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                />
                {tr("Прикрепить исходный файл при сохранении записи")}
              </label>
              <p className="field-help">
                {tr(
                  "Полный бак, пропуски заправок и исправление исторического пробега подтверждаются отдельно. Проверьте все выбранные поля и позиции перед сохранением.",
                )}
              </p>
              <div className="settings-actions">
                <Button type="button" onClick={apply}>
                  {tr("Перенести выбранные поля")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset(true);
                    setOpen(false);
                  }}
                >
                  {tr("Отменить распознавание")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
