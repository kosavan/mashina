import { useState } from "react";
import {
  FileDown,
  ShieldCheck,
  Image,
  Receipt,
  Fingerprint,
  Wrench,
} from "lucide-react";
import { useApp } from "./context";
import { Sheet } from "./components/ui/dialog";
import { Button } from "./components/ui/button";

export default function SaleReport({ vehicleId }: { vehicleId: string }) {
  const { session, state } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState({
    include_cover: false,
    include_costs: false,
    include_identifiers: false,
    include_descriptions: false,
  });
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const disclosures = [
    [
      "include_cover",
      "Обложка автомобиля",
      "Фото не анонимизируется: на нём могут быть номер и окружающая обстановка.",
      Image,
    ],
    [
      "include_costs",
      "Финансовые суммы",
      "Эксплуатационные расходы и отдельно цена покупки/продажи. Валюты не смешиваются.",
      Receipt,
    ],
    [
      "include_identifiers",
      "VIN и государственный номер",
      "Включайте только если готовы передать эти сведения получателю отчёта.",
      Fingerprint,
    ],
    [
      "include_descriptions",
      "Названия выполненных работ",
      "Свободный текст ваших записей. Проверьте, нет ли там личных сведений.",
      Wrench,
    ],
  ] as const;
  if (!vehicle || vehicle.can_edit === false) return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <FileDown size={16} />
        Отчёт для продажи
      </Button>
      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="История, которой можно поделиться"
      >
        <form
          className="record-form report-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!navigator.onLine)
                throw new Error(
                  "Для подготовки PDF нужно подключиться к вашему серверу.",
                );
              const dates = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              const response = await fetch(
                `/api/v1/vehicles/${vehicleId}/sale-report`,
                {
                  method: "POST",
                  credentials: "same-origin",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": session.csrf,
                  },
                  body: JSON.stringify({
                    start: dates.start || "",
                    end: dates.end || "",
                    ...options,
                  }),
                },
              );
              if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(
                  typeof result.detail === "string"
                    ? result.detail
                    : "Не удалось подготовить отчёт. Проверьте даты и попробуйте снова.",
                );
              }
              if (
                !response.headers
                  .get("Content-Type")
                  ?.startsWith("application/pdf")
              )
                throw new Error(
                  "Сервер вернул неподходящий файл. Повторите запрос.",
                );
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "mashina-sale-report.pdf";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="report-intro">
            <span className="event-icon">
              <FileDown size={24} />
            </span>
            <div>
              <h3>{vehicle.name}</h3>
              <p className="muted">
                Законченный PDF с характеристиками, пробегом и историей
                обслуживания.
              </p>
            </div>
          </div>
          {session.demo && (
            <div className="info-box">
              Это демонстрационный отчёт с вымышленными данными.
            </div>
          )}
          <div className="field-grid">
            <label>
              Начало периода
              <input name="start" type="date" />
            </label>
            <label>
              Конец периода
              <input name="end" type="date" />
            </label>
          </div>
          <small className="muted">
            Оставьте даты пустыми, чтобы включить всю историю. До 500 работ и 5
            000 событий за период.
          </small>
          <h3>Что раскрыть получателю</h3>
          <div className="report-options">
            {disclosures.map(([key, label, explanation, Icon]) => (
              <label className="report-option" key={key}>
                <Icon size={20} />
                <span>
                  <strong>{label}</strong>
                  <small>{explanation}</small>
                </span>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) =>
                    setOptions({ ...options, [key]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
          <div className="info-box">
            <ShieldCheck size={17} />
            <div>
              В PDF войдут характеристики автомобиля, внесённые показания
              пробега, даты обслуживания, детали и артикулы. Личные документы,
              заметки, названия сервисов и аккаунты не включаются. Выбранные
              выше сведения добавятся отдельно.
            </div>
          </div>
          <p className="tiny muted">
            Файл готовится на вашем сервере и скачивается на это устройство.
            Публичная ссылка не создаётся; никому ничего не отправляется.
          </p>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <Button disabled={busy}>
            <FileDown size={17} />
            {busy ? "Готовим ваш отчёт…" : "Скачать PDF"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
