import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ReceiptText } from "lucide-react";
import { APIError, api } from "./api";
import { useApp } from "./context";
import { tr } from "./i18n";
import { OcrReview } from "./OcrReview";
import { receiptDrafts, updateReceiptDrafts } from "./offline";
import type { ReceiptDraft, ReceiptFields } from "./receiptDraft";
import { dateLabel, defaultCurrency, today } from "./utils";
import { createUuid } from "./uuid";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { Empty, PageHeading } from "./Views";

const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const mib = 1024 * 1024;

function ReceiptReview({
  draft,
  onClose,
  onChange,
}: {
  draft: ReceiptDraft;
  onClose: () => void;
  onChange: (drafts: ReceiptDraft[]) => void;
}) {
  const { session, state, selected, refresh, notify } = useApp();
  const startingCar =
    state.vehicles.find((car) => car.id === selected) || state.vehicles[0];
  const [fields, setFields] = useState<ReceiptFields>(
    () =>
      draft.commit || {
        vehicle_id: startingCar?.id || "",
        occurred_at: draft.takenAt,
        currency: defaultCurrency(state, startingCar),
        amount: "",
        category: "",
        description: "",
      },
  );
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(draft.image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.image]);

  function update(values: Partial<ReceiptFields>) {
    setFields((prior) => ({ ...prior, ...values }));
    setDirty(true);
  }

  function close() {
    if (busy) return;
    if (
      !draft.commit &&
      dirty &&
      !confirm(tr("Закрыть форму и потерять несохранённые изменения?"))
    )
      return;
    onClose();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!navigator.onLine) {
      setError(tr("Подключитесь к серверу, чтобы подтвердить расход."));
      return;
    }
    setBusy(true);
    try {
      const pending = await updateReceiptDrafts(session.id, (rows) => {
        if (!rows.some((row) => row.id === draft.id))
          throw new Error(tr("Черновик чека уже закрыт"));
        return rows.map((row) =>
          row.id === draft.id ? { ...row, commit: row.commit || fields } : row,
        );
      });
      const current = pending.find((row) => row.id === draft.id)!;
      setFields(current.commit!);
      onChange(pending);
      const body = new FormData();
      body.set("draft_id", current.id);
      body.set("file", current.image, current.image.name);
      for (const [key, value] of Object.entries(current.commit!))
        body.set(key, value);
      try {
        await api(
          "/receipt-inbox/confirm",
          { method: "POST", body },
          session.csrf,
        );
      } catch (failure) {
        if (failure instanceof APIError && failure.status === 422)
          onChange(
            await updateReceiptDrafts(session.id, (rows) =>
              rows.map((row) =>
                row.id === draft.id ? { ...row, commit: undefined } : row,
              ),
            ),
          );
        throw failure;
      }
      onChange(
        await updateReceiptDrafts(session.id, (rows) =>
          rows.filter((row) => row.id !== draft.id),
        ),
      );
      notify(tr("Расход и чек сохранены"));
      onClose();
      void refresh().catch((failure: Error) => notify(tr(failure.message)));
    } catch (failure) {
      setError(tr((failure as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={close} title={tr("Проверить чек")} wide>
      <form
        className="record-form receipt-review"
        onSubmit={(event) => void submit(event)}
      >
        {imageUrl && (
          <img src={imageUrl} alt={tr("Фото чека")} className="receipt-photo" />
        )}
        <p className="field-help">
          {tr("При подтверждении фото прикрепится к расходу.")}
        </p>
        {draft.commit && (
          <p role="status">
            {tr("Повторите подтверждение. Расход будет сохранён один раз.")}
          </p>
        )}
        <fieldset disabled={busy || !!draft.commit} className="receipt-fields">
          <div className="field-grid">
            <label className="field">
              <span>{tr("Автомобиль")}</span>
              <select
                required
                value={fields.vehicle_id}
                onChange={(event) => {
                  const vehicle_id = event.target.value;
                  update({
                    vehicle_id,
                    currency: defaultCurrency(
                      state,
                      state.vehicles.find((car) => car.id === vehicle_id),
                    ),
                  });
                }}
              >
                <option value="">{tr("Выберите автомобиль")}</option>
                {state.vehicles.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr("Дата")}</span>
              <input
                type="date"
                required
                max={today()}
                value={fields.occurred_at}
                onChange={(event) =>
                  update({ occurred_at: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>{tr("Сумма")}</span>
              <input
                required
                inputMode="decimal"
                maxLength={16}
                value={fields.amount}
                pattern="[0-9]+([.,][0-9]{1,2})?"
                onChange={(event) => update({ amount: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{tr("Валюта")}</span>
              <input
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                value={fields.currency}
                onChange={(event) =>
                  update({ currency: event.target.value.toUpperCase() })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>{tr("Категория")}</span>
            <input
              maxLength={300}
              value={fields.category}
              onChange={(event) => update({ category: event.target.value })}
            />
          </label>
          <label className="field">
            <span>{tr("Описание")}</span>
            <textarea
              maxLength={4000}
              value={fields.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          </label>
          {fields.vehicle_id && (
            <OcrReview
              kind="expense"
              vehicleId={fields.vehicle_id}
              sourceFile={draft.image}
              onApply={(selectedFields) =>
                update({
                  amount: selectedFields.amount || fields.amount,
                  occurred_at:
                    selectedFields.occurred_at?.slice(0, 10) ||
                    fields.occurred_at,
                  description: selectedFields.description || fields.description,
                })
              }
            />
          )}
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="intake-actions">
          <Button type="submit" disabled={busy || !fields.vehicle_id}>
            {tr("Подтвердить расход")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={busy}
          >
            {tr("Закрыть")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export default function ReceiptInbox() {
  const { session, notify } = useApp();
  const client = useQueryClient();
  const queryKey = ["receipt-inbox", session.id];
  const inbox = useQuery({
    queryKey,
    queryFn: () => receiptDrafts(session.id),
    retry: false,
  });
  const [active, setActive] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = inbox.data?.find((item) => item.id === active);
  const setDrafts = (drafts: ReceiptDraft[]) =>
    client.setQueryData(queryKey, drafts);

  async function capture(image: File) {
    setError("");
    if (!photoTypes.includes(image.type)) {
      setError(tr("Выберите фотографию чека в формате JPEG, PNG или WebP"));
      return;
    }
    if (!image.size || image.size > 20 * mib) {
      setError(tr("Файл должен быть от 1 байта до 20 МБ"));
      return;
    }
    setBusy(true);
    try {
      const takenAt = today();
      const newDraft = { image, takenAt, id: createUuid() };
      setDrafts(
        await updateReceiptDrafts(session.id, (rows) => {
          if (
            rows.length >= 24 ||
            rows.reduce((size, row) => size + row.image.size, image.size) >
              64 * mib
          )
            throw new Error(
              tr(
                "В папке чеков закончилось место. Разберите сохранённые чеки.",
              ),
            );
          return [newDraft, ...rows];
        }),
      );
      void navigator.storage?.persist?.().catch(() => {});
      notify(tr("Фото чека сохранено на устройстве"));
    } catch (failure) {
      setError(tr((failure as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: ReceiptDraft) {
    if (!confirm(tr("Удалить фотографию из черновиков чеков?"))) return;
    setError("");
    setBusy(true);
    try {
      setDrafts(
        await updateReceiptDrafts(session.id, (rows) =>
          rows.filter((row) => row.id !== item.id),
        ),
      );
    } catch (failure) {
      setError(tr((failure as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        level={2}
        eyebrow={tr("ОБСЛУЖИВАНИЕ")}
        title={tr("Чеки на проверку")}
        description={tr(
          "Снимите чек сейчас, разберите позже. Черновики хранятся на этом устройстве.",
        )}
      />
      <section className="panel receipt-inbox">
        <label className="intake-picker">
          <Camera size={17} aria-hidden="true" />
          <span>{tr("Добавить фото чека")}</span>
          <input
            aria-label={tr("Добавить фото чека")}
            type="file"
            accept={photoTypes.join(",")}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void capture(file);
            }}
          />
        </label>
        {inbox.isLoading && <p role="status">{tr("Загрузка…")}</p>}
        {(error || inbox.isError) && (
          <p role="alert" className="form-error">
            {error || tr("Не удалось загрузить черновики чеков")}
          </p>
        )}
        {!inbox.isLoading && !inbox.isError && !inbox.data?.length && (
          <Empty
            icon={ReceiptText}
            title={tr("Здесь будут фотографии чеков")}
            description={tr(
              "Снимите чек сейчас, разберите позже. Черновики хранятся на этом устройстве.",
            )}
          />
        )}
        {!!inbox.data?.length && (
          <ul className="receipt-list">
            {inbox.data.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.image.name || tr("Фото чека")}</strong>
                  <div className="muted">
                    {dateLabel(item.takenAt + "T12:00:00")}
                  </div>
                </div>
                <div className="intake-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setActive(item.id)}
                  >
                    {tr("Проверить чек")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void remove(item)}
                  >
                    {tr("Удалить фото")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {draft && (
        <ReceiptReview
          key={draft.id}
          draft={draft}
          onChange={setDrafts}
          onClose={() => setActive("")}
        />
      )}
    </>
  );
}
