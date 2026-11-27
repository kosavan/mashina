import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { useApp } from "./context";
import { tr } from "./i18n";
import type { Entry, Vehicle } from "./types";
import { dateLabel, money, number, today } from "./utils";
import { createUuid } from "./uuid";
import { GaragePlaces } from "./GaragePlaces";

type Use = { event_id: string; quantity: string };
type Supply = {
  id: string;
  name: string;
  part_number: string;
  unit: string;
  shopping: boolean;
  stock: string;
  uses: Use[];
};
type Trip = {
  id: string;
  name: string;
  start: string;
  end: string;
  people: number;
  event_ids: string[];
};
type Details = { supplies: Supply[]; trips: Trip[] };
const empty: Details = { supplies: [], trips: [] };
const units = (value: string) => Math.round(Number(value) * 1000);
const validQuantity = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/;
const inputQuantity = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .trim()
    .replace(",", ".");
const entryName = (event?: Entry) =>
  event?.description || event?.station || event?.vendor || event?.category;
const dateOnly = (value: string) => dateLabel(value + "T12:00:00");

export default function GarageDetails({
  car,
  events,
}: {
  car: Vehicle;
  events: Entry[];
}) {
  const { save, notify } = useApp();
  const data: Details = car.garage_details ?? empty;
  const [supply, setSupply] = useState<Supply>();
  const [trip, setTrip] = useState<Trip>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = car.can_edit !== false;
  const byId = new Map(events.map((entry) => [entry.id, entry]));
  const maintenance = events
    .filter((entry) => entry.kind === "maintenance")
    .slice(0, 80);

  async function persist(next: Details, closed?: () => void) {
    setBusy(true);
    setError("");
    try {
      await save("vehicle", { garage_details: next }, car);
      closed?.();
      notify(tr("Сохранено"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function editSupply(item?: Supply) {
    setError("");
    setSupply(
      item ?? {
        id: createUuid(),
        name: "",
        part_number: "",
        unit: "",
        shopping: true,
        stock: "0",
        uses: [],
      },
    );
  }

  function editTrip(item?: Trip) {
    setError("");
    setTrip(
      item ?? {
        id: createUuid(),
        name: "",
        start: today(),
        end: today(),
        people: 1,
        event_ids: [],
      },
    );
  }

  function saveSupply(event: FormEvent<HTMLFormElement>, current: Supply) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selected = String(fields.get("service_event") || "");
    const quantity = inputQuantity(fields.get("use_quantity"));
    if (
      (selected || quantity) &&
      (!selected || !validQuantity.test(quantity))
    ) {
      setError(tr("Проверьте количество и остаток расходника"));
      return;
    }
    let uses = current.uses;
    if (selected && quantity) {
      uses = uses.filter((item) => item.event_id !== selected);
      if (units(quantity) !== 0)
        uses = [...uses, { event_id: selected, quantity }];
    }
    const item = {
      ...current,
      uses,
      name: String(fields.get("name")).trim(),
      part_number: String(fields.get("part_number")).trim(),
      unit: String(fields.get("unit")).trim(),
      shopping: fields.has("shopping"),
      stock: inputQuantity(fields.get("stock")),
    };
    if (
      !item.name ||
      !item.unit ||
      !validQuantity.test(item.stock) ||
      uses.reduce((sum, use) => sum + units(use.quantity), 0) >
        units(item.stock)
    ) {
      setError(tr("Проверьте количество и остаток расходника"));
      return;
    }
    const supplies = data.supplies.some((row) => row.id === item.id)
      ? data.supplies.map((row) => (row.id === item.id ? item : row))
      : [...data.supplies, item];
    void persist({ ...data, supplies }, () => setSupply(undefined));
  }

  function saveTrip(event: FormEvent<HTMLFormElement>, current: Trip) {
    event.preventDefault();
    if (current.start > current.end || !current.name.trim()) {
      setError(tr("Проверьте название и даты поездки"));
      return;
    }
    const item = { ...current, name: current.name.trim() };
    const trips = data.trips.some((row) => row.id === item.id)
      ? data.trips.map((row) => (row.id === item.id ? item : row))
      : [...data.trips, item];
    void persist({ ...data, trips }, () => setTrip(undefined));
  }

  return (
    <>
      <section
        className="panel settings-panel vehicle-section-target"
        id="vehicle-supplies"
        tabIndex={-1}
      >
        <div className="section-heading">
          <h3>{tr("Расходники и запас")}</h3>
          {canEdit && (
            <Button size="sm" onClick={() => editSupply()}>
              {tr("Добавить расходник")}
            </Button>
          )}
        </div>
        {error && !supply && !trip && <p role="alert">{tr(error)}</p>}
        {canEdit && maintenance.some((entry) => entry.items?.length) && (
          <label>
            {tr("Закрепить позицию из истории")}
            <select
              value=""
              onChange={(event) => {
                const [id, index] = event.currentTarget.value.split("/");
                const part = byId.get(id)?.items[Number(index)];
                if (!part) return;
                setError("");
                setSupply({
                  id: createUuid(),
                  name: part.name,
                  part_number: part.part_number || "",
                  unit: "шт.",
                  shopping: false,
                  stock: "0",
                  uses: [],
                });
              }}
            >
              <option value="">{tr("Выбрать позицию")}</option>
              {maintenance.flatMap((entry) =>
                (entry.items || []).map((part, index) => (
                  <option
                    key={`${entry.id}/${index}`}
                    value={`${entry.id}/${index}`}
                  >
                    {part.name}
                    {part.part_number ? ` · ${part.part_number}` : ""}
                  </option>
                )),
              )}
            </select>
          </label>
        )}
        {data.supplies.length === 0 && (
          <p className="muted">{tr("Расходников пока нет")}</p>
        )}
        {data.supplies.length > 0 && (
          <ul className="ownership-records">
            {data.supplies.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                {item.part_number && <span> · {item.part_number}</span>}
                <p>
                  {tr("В наличии: {0} {1}", [
                    number(
                      (units(item.stock) -
                        item.uses.reduce(
                          (sum, use) => sum + units(use.quantity),
                          0,
                        )) /
                        1000,
                      3,
                    ),
                    item.unit,
                  ])}
                </p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editSupply(item)}
                  >
                    {tr("Редактировать")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <h4>{tr("Купить к обслуживанию")}</h4>
        <ul>
          {data.supplies
            .filter((item) => item.shopping)
            .map((item) => (
              <li key={item.id}>
                {canEdit ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={busy}
                      onChange={() => {
                        void persist({
                          ...data,
                          supplies: data.supplies.map((row) =>
                            row.id === item.id
                              ? { ...row, shopping: false }
                              : row,
                          ),
                        });
                      }}
                    />
                    {item.name}
                    {item.part_number && ` · ${item.part_number}`}
                  </label>
                ) : (
                  item.name
                )}
              </li>
            ))}
        </ul>
        {!data.supplies.some((item) => item.shopping) && (
          <p className="muted">{tr("Список покупок пуст")}</p>
        )}
      </section>
      <section
        className="panel settings-panel vehicle-section-target"
        id="vehicle-trips"
        tabIndex={-1}
      >
        <div className="section-heading">
          <h3>{tr("Поездки")}</h3>
          {canEdit && (
            <Button size="sm" onClick={() => editTrip()}>
              {tr("Добавить поездку")}
            </Button>
          )}
        </div>
        {!data.trips.length && (
          <p className="muted">{tr("Поездок пока нет")}</p>
        )}
        {data.trips.map((item) => {
          const totals = new Map<string, number>();
          for (const id of item.event_ids) {
            const entry = byId.get(id);
            if (entry)
              totals.set(
                entry.currency,
                (totals.get(entry.currency) || 0) + entry.amount_minor,
              );
          }
          return (
            <article key={item.id}>
              <h4>{item.name}</h4>
              <p>
                {dateOnly(item.start)} — {dateOnly(item.end)}
              </p>
              {[...totals].map(([currency, total]) => (
                <p key={currency}>
                  {money(total, currency)}
                  {item.people > 1 &&
                    ` · ${tr("На человека ≈ {0}", [money(Math.round(total / item.people), currency)])}`}
                </p>
              ))}
              <p>
                {tr("Связанные записи: {0}", [
                  item.event_ids.filter((id) => byId.has(id)).length,
                ])}
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editTrip(item)}
                >
                  {tr("Редактировать")}
                </Button>
              )}
            </article>
          );
        })}
      </section>
      <GaragePlaces events={events} />
      {supply && (
        <Sheet
          open
          onClose={() => {
            if (!busy) setSupply(undefined);
          }}
          title={tr("Расходники и запас")}
        >
          <form
            className="record-form"
            onSubmit={(event) => saveSupply(event, supply)}
          >
            {error && <p role="alert">{tr(error)}</p>}
            <label>
              {tr("Название")}
              <input
                name="name"
                maxLength={120}
                required
                defaultValue={supply.name}
              />
            </label>
            <label>
              {tr("Артикул")}
              <input
                name="part_number"
                maxLength={120}
                defaultValue={supply.part_number}
              />
            </label>
            <label>
              {tr("Единица количества")}
              <input
                name="unit"
                maxLength={120}
                required
                defaultValue={supply.unit || "шт."}
              />
            </label>
            <label>
              {tr("Всего поступило")}
              <input
                name="stock"
                inputMode="decimal"
                required
                defaultValue={supply.stock}
              />
            </label>
            <label>
              <input
                name="shopping"
                type="checkbox"
                defaultChecked={supply.shopping}
              />
              {tr("Купить к обслуживанию")}
            </label>
            {supply.uses.length > 0 && (
              <ul>
                {supply.uses.map((use) => (
                  <li key={use.event_id}>
                    {entryName(byId.get(use.event_id)) ||
                      tr("Запись обслуживания")}{" "}
                    · {use.quantity}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setSupply({
                          ...supply,
                          uses: supply.uses.filter(
                            (row) => row.event_id !== use.event_id,
                          ),
                        })
                      }
                    >
                      {tr("Отменить списание")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {maintenance.length > 0 && (
              <>
                <label>
                  {tr("Списать на обслуживание")}
                  <select name="service_event">
                    <option value="">{tr("Выбрать запись")}</option>
                    {maintenance.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {dateOnly(entry.occurred_at.slice(0, 10))} ·{" "}
                        {entryName(entry)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("Количество списания (0 отменяет списание)")}
                  <input name="use_quantity" inputMode="decimal" />
                </label>
              </>
            )}
            <Button type="submit" disabled={busy}>
              {tr("Сохранить")}
            </Button>
          </form>
        </Sheet>
      )}
      {trip && (
        <Sheet
          open
          wide
          onClose={() => {
            if (!busy) setTrip(undefined);
          }}
          title={tr("Поездки")}
        >
          <form
            className="record-form"
            onSubmit={(event) => saveTrip(event, trip)}
          >
            {error && <p role="alert">{tr(error)}</p>}
            <label>
              {tr("Название")}
              <input
                maxLength={120}
                required
                value={trip.name}
                onChange={(e) =>
                  setTrip({ ...trip, name: e.currentTarget.value })
                }
              />
            </label>
            <label>
              {tr("Начало поездки")}
              <input
                type="date"
                required
                value={trip.start}
                onChange={(e) =>
                  setTrip({ ...trip, start: e.currentTarget.value })
                }
              />
            </label>
            <label>
              {tr("Конец поездки")}
              <input
                type="date"
                required
                value={trip.end}
                onChange={(e) =>
                  setTrip({ ...trip, end: e.currentTarget.value })
                }
              />
            </label>
            <label>
              {tr("Число участников")}
              <input
                type="number"
                min={1}
                max={99}
                required
                value={trip.people}
                onChange={(e) =>
                  setTrip({ ...trip, people: e.currentTarget.valueAsNumber })
                }
              />
            </label>
            <fieldset>
              <legend>{tr("Выберите расходы поездки")}</legend>
              {events
                .filter((entry) => {
                  const day = entry.occurred_at.slice(0, 10);
                  return (
                    ["fuel", "expense", "maintenance"].includes(entry.kind) &&
                    (trip.event_ids.includes(entry.id) ||
                      (day >= trip.start && day <= trip.end))
                  );
                })
                .sort(
                  (a, b) =>
                    Number(trip.event_ids.includes(b.id)) -
                    Number(trip.event_ids.includes(a.id)),
                )
                .slice(0, 150)
                .map((entry) => (
                  <label key={entry.id}>
                    <input
                      type="checkbox"
                      checked={trip.event_ids.includes(entry.id)}
                      onChange={(e) =>
                        setTrip({
                          ...trip,
                          event_ids: e.currentTarget.checked
                            ? [...trip.event_ids, entry.id]
                            : trip.event_ids.filter((id) => id !== entry.id),
                        })
                      }
                    />
                    {dateOnly(entry.occurred_at.slice(0, 10))} ·{" "}
                    {entryName(entry)} ·{" "}
                    {money(entry.amount_minor, entry.currency)}
                  </label>
                ))}
            </fieldset>
            <Button type="submit" disabled={busy}>
              {tr("Сохранить")}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
