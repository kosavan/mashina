import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ArrowRight,
  Check,
  FileDown,
  FileSpreadsheet,
  Link2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useApp } from "./context";
import { api } from "./offline";
import { money } from "./utils";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import {
  reviewSummary,
  selectedDecisions,
  type BankRow,
  type Choices,
  type Decision,
} from "./bankReview";

type Source = { id: string; label: string };
type Mapping = {
  date: string;
  amount: string;
  description: string;
  transaction_id: string | null;
  currency: string | null;
  date_format: "iso" | "russian";
  outgoing_sign: "negative" | "positive";
  default_currency: "RUB" | "EUR" | "USD";
};
type Preview = { batch_id: string; expires: number; rows: BankRow[] };
type Result = {
  created: number;
  linked: number;
  ignored: number;
  processed: number;
  event_ids: string[];
};
const initial: Mapping = {
  date: "",
  amount: "",
  description: "",
  transaction_id: null,
  currency: null,
  date_format: "russian",
  outgoing_sign: "negative",
  default_currency: "RUB",
};
const kindNames: Record<string, string> = {
  fuel: "Заправка",
  maintenance: "ТО / ремонт",
  expense: "Расход",
};
const dateLabel = (value: string) => value.split("-").reverse().join(".");

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="bank-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

export default function BankImport() {
  const { selected, session, state, queue, refresh, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File>();
  const [encoding, setEncoding] = useState("utf-8");
  const [delimiter, setDelimiter] = useState("semicolon");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(initial);
  const [preview, setPreview] = useState<Preview>();
  const [choices, setChoices] = useState<Choices>({});
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result>();
  const [online, setOnline] = useState(navigator.onLine);
  const submitted = useRef<{
    operation_id: string;
    batch_id: string;
    decisions: Decision[];
  } | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const car = state.vehicles.find((v) => v.id === selected);
  const ready = online && queue.length === 0;
  const summary = reviewSummary(preview?.rows || [], choices);
  const count = selectedDecisions(choices).length;
  const needsAck = preview?.rows.some(
    (r) =>
      r.overlap &&
      choices[r.row_id] &&
      choices[r.row_id].action !== "ignore" &&
      !choices[r.row_id].ack_separate,
  );
  if (!car || car.can_edit === false) return null;

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      if (!navigator.onLine)
        throw new Error(
          "Для проверки выписки подключитесь к своему серверу. Файл не сохраняется на устройстве.",
        );
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    if (
      !result &&
      count &&
      !confirm("Закрыть проверку и потерять неподтверждённые решения?")
    )
      return;
    setOpen(false);
    setFile(undefined);
    setPreview(undefined);
    setHeaders([]);
    setChoices({});
    setResult(undefined);
    setStep(1);
    setPage(0);
    submitted.current = null;
  }
  function uploadData() {
    if (!file) throw new Error("Выберите CSV-файл");
    if (file.size > 2 * 1024 * 1024)
      throw new Error("CSV не должен превышать 2 МБ");
    const data = new FormData();
    data.set("file", file);
    data.set("vehicle_id", selected);
    data.set("encoding", encoding);
    data.set("delimiter", delimiter);
    return data;
  }
  function choose(row: BankRow, value: string) {
    submitted.current = null;
    setChoices((old) => {
      const next = { ...old };
      delete next[row.row_id];
      if (value === "create" || value === "ignore")
        next[row.row_id] = { row_id: row.row_id, action: value };
      else if (value) {
        const target = row.candidates.find((c) => c.id === value);
        if (target)
          next[row.row_id] = {
            row_id: row.row_id,
            action: "link",
            event_id: target.id,
            expected_version: target.version,
          };
      }
      return next;
    });
  }
  function changeChoice(id: number, patch: Partial<Decision>) {
    submitted.current = null;
    setChoices((old) => ({ ...old, [id]: { ...old[id], ...patch } }));
  }
  async function buildPreview() {
    if (queue.length)
      throw new Error(
        "Сначала синхронизируйте ожидающие записи, чтобы проверять актуальную историю.",
      );
    let sid = sourceId;
    if (!sid) {
      const source = await api<Source>(
        "/bank/sources",
        {
          method: "POST",
          body: JSON.stringify({ vehicle_id: selected, label }),
        },
        session.csrf,
      );
      sid = source.id;
      setSourceId(sid);
      setSources((old) =>
        old.some((s) => s.id === sid) ? old : [...old, source],
      );
    }
    const data = uploadData();
    data.set("source_id", sid);
    data.set("mapping", JSON.stringify(mapping));
    const next = await api<Preview>(
      "/bank/preview",
      { method: "POST", body: data },
      session.csrf,
    );
    setPreview(next);
    setChoices({});
    setPage(0);
    setStep(2);
    submitted.current = null;
  }
  const totals = (
    <div className="bank-totals">
      <span>Новые расходы</span>
      {Object.entries(summary.totals).length ? (
        Object.entries(summary.totals).map(([currency, amount]) => (
          <strong key={currency}>{money(Number(amount), currency)}</strong>
        ))
      ) : (
        <strong>Не добавляются</strong>
      )}
      <small>Связанные и пропущенные операции не увеличивают расходы.</small>
    </div>
  );
  return (
    <>
      <section className="panel bank-intro">
        <div className="bank-icon">
          <FileSpreadsheet size={24} />
        </div>
        <div>
          <span className="eyebrow">ВЫПИСКА → ПРОВЕРКА → ИСТОРИЯ</span>
          <h3>Расходы из банка</h3>
          <p className="muted">
            Сопоставьте CSV с историей машины. Уже записанные заправки и работы
            можно связать без повторного расхода.
          </p>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
            void run(async () =>
              setSources(
                await api<Source[]>(`/bank/sources?vehicle_id=${selected}`),
              ),
            );
          }}
        >
          Проверить выписку <ArrowRight size={17} />
        </Button>
      </section>
      <Sheet open={open} onClose={close} title="Расходы из банка" wide>
        <div className="record-form bank-flow">
          <div className="bank-steps" aria-label={`Шаг ${step} из 3`}>
            {["Столбцы", "Операции", "Подтверждение"].map((name, i) => (
              <span key={name} className={step === i + 1 ? "active" : ""}>
                <b>{i + 1}</b>
                {name}
              </span>
            ))}
          </div>
          <p className="bank-car">
            <strong>{car.name}</strong>
            <span>Выписка доступна только вам</span>
          </p>
          {!online && (
            <p className="form-error" role="status">
              Нет подключения. Проверка и подтверждение выписки доступны только
              онлайн; файл и решения не сохраняются на устройстве.
            </p>
          )}
          {!!queue.length && (
            <p className="form-error" role="status">
              Сначала синхронизируйте ожидающие записи. Это нужно для проверки
              актуальных совпадений.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <p className="muted" role="status">
              Проверяем на вашем сервере…
            </p>
          )}
          {result ? (
            <div className="bank-success" role="status">
              <div className="bank-icon">
                <Check size={28} />
              </div>
              <h3>История обновлена</h3>
              <p>
                Новых расходов: {result.created}. Связано: {result.linked}.
                Пропущено: {result.ignored}. Уже подтверждено:{" "}
                {result.processed}.
              </p>
              <p className="muted">
                Исходный CSV не сохранён. Подтверждения повторного импорта
                хранятся вместе с резервной копией.
              </p>
              <Button onClick={close}>Готово</Button>
            </div>
          ) : step === 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(buildPreview);
              }}
            >
              <div className="bank-privacy">
                <ShieldCheck size={20} />
                <p>
                  Без подключения к банку. Выберите только нужные столбцы.
                  Остальные значения и оригинал файла не сохраняются;
                  предпросмотр доступен 30 минут.
                </p>
              </div>
              <div className="field-grid">
                <Field label="Кодировка">
                  <select
                    value={encoding}
                    disabled={busy}
                    onChange={(e) => {
                      setEncoding(e.target.value);
                      setHeaders([]);
                    }}
                  >
                    <option value="utf-8">UTF-8 (включая BOM)</option>
                    <option value="cp1251">Windows-1251</option>
                  </select>
                </Field>
                <Field label="Разделитель">
                  <select
                    value={delimiter}
                    disabled={busy}
                    onChange={(e) => {
                      setDelimiter(e.target.value);
                      setHeaders([]);
                    }}
                  >
                    <option value="semicolon">Точка с запятой</option>
                    <option value="comma">Запятая</option>
                    <option value="tab">Табуляция</option>
                  </select>
                </Field>
              </div>
              <label className="file-picker">
                <Upload size={22} />
                <span>{file?.name || "Выбрать банковский CSV"}</span>
                <input
                  aria-label="Банковский CSV"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0]);
                    setHeaders([]);
                    setMapping(initial);
                    setError("");
                  }}
                />
              </label>
              <p className="field-help">
                До 2 МБ и 1 000 строк. Нужен один столбец со знаком суммы. XLSX,
                PDF и отдельные столбцы прихода/расхода здесь не поддерживаются.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !online || !file}
                onClick={() =>
                  void run(async () => {
                    const inspected = await api<{
                      headers: string[];
                      row_count: number;
                    }>(
                      "/bank/inspect",
                      { method: "POST", body: uploadData() },
                      session.csrf,
                    );
                    setHeaders(inspected.headers);
                    setRowCount(inspected.row_count);
                    setMapping(initial);
                  })
                }
              >
                Прочитать столбцы
              </Button>
              {!!headers.length && (
                <>
                  <h3 className="bank-section-title">
                    Какие поля использовать?
                  </h3>
                  <p className="muted">
                    Строк в файле: {rowCount}. Значения несопоставленных
                    столбцов не попадут в приложение.
                  </p>
                  <div className="field-grid">
                    {(
                      [
                        ["date", "Дата операции"],
                        ["amount", "Сумма операции"],
                        ["description", "Описание операции"],
                        ["transaction_id", "ID операции банка"],
                        ["currency", "Валюта операции"],
                      ] as const
                    ).map(([key, title]) => (
                      <Field key={key} label={title}>
                        <select
                          value={mapping[key] || ""}
                          required={["date", "amount", "description"].includes(
                            key,
                          )}
                          onChange={(e) =>
                            setMapping((old) => ({
                              ...old,
                              [key]: e.target.value || null,
                            }))
                          }
                        >
                          <option value="">
                            {["transaction_id", "currency"].includes(key)
                              ? "Не использовать"
                              : "Выберите столбец"}
                          </option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                  <div className="field-grid">
                    <Field label="Формат даты">
                      <select
                        value={mapping.date_format}
                        onChange={(e) =>
                          setMapping((old) => ({
                            ...old,
                            date_format: e.target
                              .value as Mapping["date_format"],
                          }))
                        }
                      >
                        <option value="russian">ДД.ММ.ГГГГ</option>
                        <option value="iso">ГГГГ-ММ-ДД</option>
                      </select>
                    </Field>
                    <Field label="Как обозначен расход">
                      <select
                        value={mapping.outgoing_sign}
                        onChange={(e) =>
                          setMapping((old) => ({
                            ...old,
                            outgoing_sign: e.target
                              .value as Mapping["outgoing_sign"],
                          }))
                        }
                      >
                        <option value="negative">
                          Отрицательная сумма (−)
                        </option>
                        <option value="positive">
                          Положительная сумма (+)
                        </option>
                      </select>
                    </Field>
                    <Field label="Валюта без столбца">
                      <select
                        value={mapping.default_currency}
                        disabled={!!mapping.currency}
                        onChange={(e) =>
                          setMapping((old) => ({
                            ...old,
                            default_currency: e.target
                              .value as Mapping["default_currency"],
                          }))
                        }
                      >
                        {["RUB", "EUR", "USD"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Личный источник выписки">
                    <select
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                    >
                      <option value="">Создать источник</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!sourceId && (
                    <Field label="Название источника">
                      <input
                        value={label}
                        required
                        maxLength={80}
                        placeholder="Например, основной банк — без номера карты"
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </Field>
                  )}
                  <p className="field-help">
                    Для повторных выгрузок выбирайте тот же источник. Без ID
                    банка совпадения между разными файлами требуют проверки.
                    Источники других пользователей изолированы.
                  </p>
                  <Button type="submit" disabled={busy || !ready || !rowCount}>
                    Показать операции <ArrowRight size={17} />
                  </Button>
                </>
              )}
            </form>
          ) : step === 2 && preview ? (
            <>
              <div className="bank-review-heading">
                <h3>Проверьте каждую операцию</h3>
                <span>
                  {preview.rows.length} строк · до{" "}
                  {new Date(preview.expires * 1000).toLocaleTimeString(
                    "ru-RU",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </span>
              </div>
              <p className="muted">
                Ничего не выбрано автоматически. Связь с записью сохраняет её
                сумму и историю. Не относящиеся к машине операции оставьте без
                выбора или пропустите.
              </p>
              {preview.rows.length === 0 && (
                <p className="muted">
                  В файле нет операций. Выберите другой CSV.
                </p>
              )}
              <div className="bank-rows">
                {preview.rows.slice(page * 50, page * 50 + 50).map((row) => {
                  const choice = choices[row.row_id];
                  const data = row.data;
                  return (
                    <article
                      className={`bank-row ${row.processed ? "processed" : ""}`}
                      key={row.row_id}
                      aria-label={`Операция ${row.row_id}`}
                    >
                      <header>
                        <span>
                          #{row.row_id} ·{" "}
                          {data ? dateLabel(data.date) : "Неверные данные"}
                        </span>
                        <strong>
                          {data
                            ? money(Math.abs(data.signed_minor), data.currency)
                            : "—"}
                        </strong>
                      </header>
                      <p className="bank-description">
                        {data?.description || "Без описания"}
                      </p>
                      {row.conflict ? (
                        <p className="form-error">
                          ID банка уже подтверждён с другими данными. Эта строка
                          заблокирована.
                        </p>
                      ) : row.processed ? (
                        <p className="bank-linked">
                          <Check size={15} /> Уже подтверждено — повторного
                          расхода не будет
                        </p>
                      ) : (
                        <>
                          {row.error && (
                            <p className="form-error">{row.error}</p>
                          )}
                          {!!data && (
                            <>
                              <Field
                                label={`Решение для операции ${row.row_id}`}
                              >
                                <select
                                  disabled={busy}
                                  value={
                                    choice?.action === "link"
                                      ? choice.event_id
                                      : choice?.action || ""
                                  }
                                  onChange={(e) => choose(row, e.target.value)}
                                >
                                  <option value="">Оставить без выбора</option>
                                  {!row.error && (
                                    <option value="create">
                                      Создать новый расход
                                    </option>
                                  )}
                                  {!row.error &&
                                    row.candidates.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        Связать: {kindNames[c.kind]} ·{" "}
                                        {dateLabel(c.date)} ·{" "}
                                        {c.description || "без описания"}
                                      </option>
                                    ))}
                                  <option value="ignore">
                                    Пропустить и запомнить решение
                                  </option>
                                </select>
                              </Field>
                              {!row.error && (
                                <p className="field-help">
                                  Совпадений по сумме, валюте и дате ±3 дня:{" "}
                                  {row.candidate_count}.
                                  {row.candidate_count > 5 &&
                                    " Показаны пять ближайших; уточните историю перед выбором."}
                                </p>
                              )}
                              {choice?.action === "link" && (
                                <div className="bank-linked">
                                  <Link2 size={16} />
                                  <span>
                                    Связь не изменит существующую запись.
                                  </span>
                                </div>
                              )}
                              {choice?.action === "create" && (
                                <div className="bank-edit">
                                  <Field
                                    label={`Категория операции ${row.row_id}`}
                                  >
                                    <input
                                      value={choice.category ?? "Прочее"}
                                      maxLength={300}
                                      onChange={(e) =>
                                        changeChoice(row.row_id, {
                                          category: e.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                  <Field
                                    label={`Описание расхода ${row.row_id}`}
                                  >
                                    <textarea
                                      value={
                                        choice.description ?? data.description
                                      }
                                      maxLength={2000}
                                      rows={2}
                                      onChange={(e) =>
                                        changeChoice(row.row_id, {
                                          description: e.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                  <p className="field-help">
                                    Описание нового расхода будет видно в общей
                                    истории машины. Уберите из него личные
                                    сведения.
                                  </p>
                                </div>
                              )}
                              {row.overlap && (
                                <div className="bank-overlap">
                                  <p>
                                    Похожая операция уже встречалась в другой
                                    выписке без ID банка.
                                  </p>
                                  {choice && choice.action !== "ignore" && (
                                    <label className="check-field">
                                      <input
                                        type="checkbox"
                                        checked={!!choice.ack_separate}
                                        onChange={(e) =>
                                          changeChoice(row.row_id, {
                                            ack_separate: e.target.checked,
                                          })
                                        }
                                      />
                                      Это отдельная операция, подтверждаю
                                    </label>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
              {preview.rows.length > 50 && (
                <div className="bank-pagination">
                  <Button
                    variant="outline"
                    disabled={page === 0 || busy}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  <span>
                    Страница {page + 1} из {Math.ceil(preview.rows.length / 50)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * 50 >= preview.rows.length || busy}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </Button>
                </div>
              )}
              {totals}
              <p className="field-help">
                Без выбора: {summary.unresolved}. Уже подтверждено:{" "}
                {summary.processed}. Ничего не запишется до следующего шага.
              </p>
              {needsAck && (
                <p className="form-error">
                  Подтвердите отдельные операции с предупреждением о совпадении.
                </p>
              )}
              <div className="form-footer">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !count ||
                      confirm(
                        "Вернуться к столбцам? Неподтверждённые решения будут сброшены.",
                      )
                    ) {
                      setStep(1);
                      setChoices({});
                      submitted.current = null;
                    }
                  }}
                >
                  К столбцам
                </Button>
                <Button
                  disabled={busy || !ready || !count || needsAck}
                  onClick={() => {
                    setError("");
                    setStep(3);
                  }}
                >
                  Проверить итог
                </Button>
              </div>
            </>
          ) : step === 3 && preview ? (
            <>
              <h3>Только проверенные изменения</h3>
              {totals}
              <div className="bank-confirm-grid">
                <span>
                  <strong>{summary.created}</strong>новых расходов
                </span>
                <span>
                  <strong>{summary.linked}</strong>связей с историей
                </span>
                <span>
                  <strong>{summary.ignored}</strong>пропущено
                </span>
              </div>
              <p className="muted">
                Строки без выбора ({summary.unresolved}) останутся нетронутыми.
                Связанные заправки и ремонты сохранятся как есть. При ошибке
                одной операции весь выбранный набор будет отменён.
              </p>
              <div className="form-footer">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep(2)}
                >
                  К операциям
                </Button>
                <Button
                  disabled={busy || !ready || !count || needsAck}
                  onClick={() =>
                    void run(async () => {
                      submitted.current ??= {
                        operation_id: crypto.randomUUID(),
                        batch_id: preview.batch_id,
                        decisions: selectedDecisions(choices),
                      };
                      const saved = await api<Result>(
                        "/bank/commit",
                        {
                          method: "POST",
                          body: JSON.stringify(submitted.current),
                        },
                        session.csrf,
                      );
                      setResult(saved);
                      try {
                        await refresh();
                      } catch {
                        notify(
                          "Изменения сохранены. Обновите историю после подключения.",
                        );
                      }
                    })
                  }
                >
                  {busy ? "Подтверждаем…" : "Подтвердить импорт"}
                </Button>
              </div>
            </>
          ) : null}
          <div className="bank-export">
            <Button
              variant="ghost"
              disabled={busy || !online}
              onClick={() =>
                void run(async () => {
                  const data = await api<unknown>(
                    `/bank/export?vehicle_id=${selected}`,
                  );
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "mashina-bank-review.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                })
              }
            >
              <FileDown size={16} />
              Личный журнал подтверждений
            </Button>
            <small>
              Содержит выбранные банковские поля. Храните файл приватно; обычный
              экспорт истории их не включает.
            </small>
          </div>
        </div>
      </Sheet>
    </>
  );
}
