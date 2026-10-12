import { useState } from "react";
import { MapPin, Copy, ArrowUpRight } from "lucide-react";
import type { Entry } from "./types";
import { useApp } from "./context";

export function ServiceLocation({ entry }: { entry: Entry }) {
  const [show, setShow] = useState(false);
  const { notify } = useApp();
  const lat = entry.service_latitude;
  const lon = entry.service_longitude;
  const hasPoint = lat != null && lon != null;
  if (!entry.service_address && !hasPoint) return null;
  const bounds = hasPoint
    ? [
        Math.max(-180, Number(lon) - 0.012),
        Math.max(-90, Number(lat) - 0.007),
        Math.min(180, Number(lon) + 0.012),
        Math.min(90, Number(lat) + 0.007),
      ].join(",")
    : "";
  const params = new URLSearchParams({
    bbox: bounds,
    layer: "mapnik",
    marker: `${lat},${lon}`,
  });
  return (
    <section className="service-location">
      <div className="section-heading">
        <span className="eyebrow">МЕСТО В ИСТОРИИ</span>
        <MapPin size={20} />
      </div>
      <h3>{entry.vendor || "Место обслуживания"}</h3>
      <p>{entry.service_address || "Точка указана вручную"}</p>
      {hasPoint && (
        <small>
          {Number(lat).toFixed(5)}, {Number(lon).toFixed(5)} · точка владельца
        </small>
      )}
      <div className="ownership-actions">
        <button
          type="button"
          className="text-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                entry.service_address || `${lat}, ${lon}`,
              );
              notify("Адрес скопирован");
            } catch {
              notify("Не удалось скопировать. Выделите адрес вручную.");
            }
          }}
        >
          <Copy size={15} />
          Скопировать
        </button>
        {hasPoint && (
          <button
            type="button"
            className="text-link"
            onClick={() => setShow((value) => !value)}
          >
            {show ? "Скрыть карту" : "Загрузить карту · OpenStreetMap"}
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      {!show && hasPoint && (
        <p className="field-help">
          Карта загружается только по нажатию. OpenStreetMap получит ваш IP и
          координаты этой области.
        </p>
      )}
      {!hasPoint && (
        <p className="field-help">
          Для карты добавьте координаты в параметрах записи. Адрес хранится
          локально и не отправляется на геокодирование.
        </p>
      )}
      {show &&
        (navigator.onLine ? (
          <>
            <iframe
              title="Место обслуживания на OpenStreetMap"
              src={`https://www.openstreetmap.org/export/embed.html?${params}`}
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <p className="field-help">
              © OpenStreetMap contributors · Если карта недоступна, адрес и
              координаты остаются выше.
            </p>
          </>
        ) : (
          <p role="status">Карта требует подключения. Адрес доступен офлайн.</p>
        ))}
    </section>
  );
}
