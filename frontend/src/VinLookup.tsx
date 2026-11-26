import { useState } from "react";
import { api } from "./api";
import { Button } from "./components/ui/button";
import { Sheet } from "./components/ui/dialog";
import { useApp } from "./context";
import { tr } from "./i18n";
import type { Vehicle } from "./types";

const labels = {
  brand: "Марка",
  model: "Модель",
  year: "Год выпуска",
  trim: "Комплектация",
  engine: "Двигатель",
  transmission: "Коробка передач",
  drive: "Привод",
  fuel: "Топливо",
};

type VINField = keyof typeof labels;
type VINResult = {
  fields: Partial<Record<VINField, string | number>>;
  partial: boolean;
};

export default function VinLookup({ car }: { car: Vehicle }) {
  const { session, save, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<VINResult>();
  const [checked, setChecked] = useState<VINField[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const data = await api<VINResult>(
        `/vehicles/${car.id}/decode-vin`,
        {
          method: "POST",
          body: JSON.stringify({ expected_version: car.version }),
        },
        session.csrf,
      );
      setChecked(
        (Object.keys(data.fields) as VINField[]).filter((key) => !car[key]),
      );
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result || !checked.length) return;
    setBusy(true);
    setError("");
    try {
      await save(
        "vehicle",
        Object.fromEntries(checked.map((key) => [key, result.fields[key]])),
        car,
      );
      notify(tr("Характеристики автомобиля сохранены"));
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (session.demo || car.can_edit === false || !car.vin) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {tr("Расшифровать VIN")}
      </Button>
      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={tr("Расшифровать VIN")}
      >
        <div className="record-form">
          <p>
            {tr(
              "По вашему запросу VIN и указанный год будут отправлены в NHTSA vPIC. Покрытие зависит от рынка автомобиля.",
            )}
          </p>
          {error && <p role="alert">{tr(error)}</p>}
          {result ? (
            <>
              {result.partial && (
                <p>
                  {tr(
                    "Источник вернул неполные данные. Сверьте характеристики перед сохранением.",
                  )}
                </p>
              )}
              {Object.keys(result.fields).length === 0 && (
                <p>{tr("Характеристики для этого VIN не найдены")}</p>
              )}
              {(
                Object.entries(result.fields) as [VINField, string | number][]
              ).map(([key, value]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={checked.includes(key)}
                    disabled={busy}
                    onChange={(event) =>
                      setChecked(
                        event.currentTarget.checked
                          ? [...checked, key]
                          : checked.filter((item) => item !== key),
                      )
                    }
                  />
                  {tr(labels[key])} · {car[key] ? `${car[key]} → ` : ""}
                  {value}
                </label>
              ))}
              <Button
                disabled={busy || !checked.length}
                onClick={() => void apply()}
              >
                {tr("Сохранить выбранное")}
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={() => void lookup()}>
              {tr(busy ? "Загрузка…" : "Запросить в NHTSA vPIC")}
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
