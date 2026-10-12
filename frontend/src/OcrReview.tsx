import { useEffect, useRef, useState } from "react";
import { ScanText } from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import { tr } from "./i18n";
import { Button } from "./components/ui/button";

type Mode = "receipt" | "service" | "odometer" | "screenshot";
export type OcrFields = Partial<
  Record<
    "amount" | "liters" | "price" | "odometer" | "occurred_at" | "description",
    string
  >
>;
type Result = { text: string; fields: OcrFields; engine: string };

export function OcrReview({
  kind,
  vehicleId,
  onApply,
}: {
  kind: string;
  vehicleId: string;
  onApply: (fields: OcrFields, source?: File) => void;
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
  const [result, setResult] = useState<Result>();
  const [values, setValues] = useState<OcrFields>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
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
      if (!Object.keys(fields).length) {
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
      onApply(fields, attach ? file : undefined);
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
                  "Полный бак, пропуски заправок и исправление исторического пробега подтверждаются отдельно. Развёрнутые позиции счёта пока внесите вручную по распознанному тексту.",
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
