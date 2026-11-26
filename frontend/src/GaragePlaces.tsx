import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "./components/ui/button";
import { ServiceLocation } from "./ServiceLocation";
import { tr } from "./i18n";
import type { Entry } from "./types";
import { dateLabel, money } from "./utils";
import "./garage-places.css";

function placeName(event: Entry) {
  return (
    event.station ||
    event.vendor ||
    event.service_address ||
    tr("Место обслуживания")
  );
}

function hasPoint(event: Entry) {
  return event.service_latitude != null && event.service_longitude != null;
}

function groupPlaces(events: Entry[]) {
  const groups = new Map<
    string,
    { id: string; latest: Entry; count: number }
  >();
  for (const event of [...events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  )) {
    if (
      !event.station &&
      !event.vendor &&
      !event.service_address &&
      !hasPoint(event)
    )
      continue;
    const place = [
      event.station || event.vendor,
      event.service_address,
      event.service_latitude,
      event.service_longitude,
    ].map((value) =>
      String(value ?? "")
        .trim()
        .toLocaleLowerCase(),
    );
    const key = JSON.stringify(place);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { id: event.id, latest: event, count: 1 });
  }
  return [...groups.values()];
}

const inset = 8;
const span = 100 - 2 * inset;

export function GaragePlaces({ events }: { events: Entry[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [limit, setLimit] = useState(8);
  const places = groupPlaces(events);
  const filtered = places.filter(({ latest }) =>
    [placeName(latest), latest.service_address]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const markers = filtered
    .filter(({ latest }) => hasPoint(latest))
    .slice(0, 80);
  const lats = markers.map(({ latest }) => Number(latest.service_latitude));
  const longs = markers.map(({ latest }) => Number(latest.service_longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLong = Math.min(...longs);
  const maxLong = Math.max(...longs);
  const chosen = filtered.find((item) => item.id === active);
  return (
    <section className="panel settings-panel">
      <h3>{tr("Места из истории")}</h3>
      {!places.length && (
        <p className="muted">
          {tr("Сохраните заправку или обслуживание с местом")}
        </p>
      )}
      {places.length > 0 && (
        <label>
          {tr("Поиск мест")}
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setLimit(8);
            }}
          />
        </label>
      )}
      {places.length > 0 && !filtered.length && <p>{tr("Места не найдены")}</p>}
      {markers.length > 0 && (
        <div
          className="garage-places-map"
          aria-label={tr("Схема сохранённых мест")}
        >
          {markers.map(({ id, latest }) => {
            const top =
              minLat === maxLat
                ? 50
                : inset +
                  (span * (maxLat - Number(latest.service_latitude))) /
                    (maxLat - minLat);
            const left =
              minLong === maxLong
                ? 50
                : inset +
                  (span * (Number(latest.service_longitude) - minLong)) /
                    (maxLong - minLong);
            return (
              <button
                type="button"
                key={id}
                title={placeName(latest)}
                aria-label={placeName(latest)}
                aria-pressed={active === id}
                style={{ top: `${top}%`, left: `${left}%` }}
                onClick={() => setActive(id)}
              >
                <MapPin size={18} />
              </button>
            );
          })}
        </div>
      )}
      <ul className="garage-places-list">
        {filtered.slice(0, limit).map(({ id, latest, count }) => (
          <li key={id}>
            <button
              className="text-link"
              type="button"
              onClick={() => setActive(active === id ? "" : id)}
              aria-expanded={active === id}
            >
              {placeName(latest)}
            </button>
            <span>
              {tr("Визитов: {0}", [count])} ·{" "}
              {dateLabel(latest.occurred_at.slice(0, 10) + "T12:00:00")} ·{" "}
              {money(latest.amount_minor, latest.currency)}
            </span>
          </li>
        ))}
      </ul>
      {chosen && (
        <article>
          <h4>{placeName(chosen.latest)}</h4>
          {chosen.latest.description && <p>{chosen.latest.description}</p>}
          <ServiceLocation
            key={`${chosen.id}:${chosen.latest.service_latitude}:${chosen.latest.service_longitude}`}
            entry={chosen.latest}
          />
        </article>
      )}
      {limit < filtered.length && (
        <Button variant="outline" onClick={() => setLimit(limit + 8)}>
          {tr("Показать ещё")}
        </Button>
      )}
    </section>
  );
}
