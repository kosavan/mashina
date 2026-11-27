import { useState } from "react";
import { Fuel } from "lucide-react";
import { fuelPreview, type FuelValues } from "./calculations";
import { SuggestionField } from "./SuggestionField";
import { tr } from "./i18n";
import type { Entry, RecordBase, Vehicle } from "./types";
import { money, number, volumeShort, type VolumeUnit } from "./utils";

const fuelGrades = [
  "АИ-92",
  "АИ-95",
  "АИ-98",
  "АИ-100",
  "Дизель",
  "LPG",
  "CNG",
];

const fuelAmountFields = [
  { key: "liters", min: "0.001", step: "0.001" },
  { key: "amount", min: "0.01", step: "0.01" },
  { key: "price", min: "0", step: "any" },
] as const;

export function FuelAmountFields({
  values,
  labels,
  currency,
  volume,
  onChange,
}: {
  values: FuelValues;
  labels: Record<keyof FuelValues, string>;
  currency: string;
  volume: VolumeUnit;
  onChange: (key: keyof FuelValues, value: string) => void;
}) {
  const preview = fuelPreview(values);
  const formatted = preview
    ? preview.field === "amount"
      ? money(preview.value, currency)
      : preview.field === "liters"
        ? `${number(preview.value, 3)} ${volumeShort(volume)}`
        : number(preview.value, 4)
    : "";
  return (
    <fieldset className="fuel-amount-fields">
      <legend className="fuel-form-heading">
        <Fuel size={17} aria-hidden="true" />
        {tr("Любые два значения — третье рассчитаем")}
      </legend>
      <div className="fuel-amount-grid">
        {fuelAmountFields.map(({ key, min, step }) => (
          <label
            className={key === "price" ? "fuel-unit-price" : undefined}
            key={key}
          >
            {labels[key]}
            <input
              type="number"
              min={min}
              step={step}
              inputMode="decimal"
              value={values[key]}
              onChange={(event) => onChange(key, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>
      <output className="fuel-calculated-value">
        {preview && (
          <>
            <span>
              {labels[preview.field]} · {tr("Автоматически")}
            </span>
            <strong>{formatted}</strong>
          </>
        )}
      </output>
    </fieldset>
  );
}

export function FuelDetailsFields({
  record,
  vehicle,
  events,
  onDirty,
}: {
  record?: RecordBase;
  vehicle?: Vehicle;
  events: Entry[];
  onDirty: () => void;
}) {
  const history = events
    .filter((event) => event.kind === "fuel" && !event.deleted)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const vehicleHistory = history.filter(
    (event) => event.vehicle_id === vehicle?.id,
  );
  const recent = vehicleHistory[0];
  const presetLabels = new Map(fuelGrades.map((grade) => [grade, tr(grade)]));
  const options = new Map(
    Array.from(presetLabels, ([value, label]) => [label, value]),
  );
  const seen = new Set<string>();
  for (const value of [
    ...vehicleHistory.map((event) => event.fuel),
    vehicle?.fuel,
  ]) {
    if (typeof value !== "string" || !value) continue;
    const label = presetLabels.get(value) ?? value;
    if (!seen.has(label)) options.set(label, value);
    seen.add(label);
  }
  const stationOptions = [
    ...new Set(
      [recent?.station, ...history.map((event) => event.station)].filter(
        Boolean,
      ),
    ),
  ];
  const initialFuel =
    record?.fuel ?? (recent?.fuel || vehicle?.fuel || "АИ-95");
  const [fuel, setFuel] = useState({
    value: initialFuel,
    label: record
      ? initialFuel
      : (presetLabels.get(initialFuel) ?? initialFuel),
  });
  const [station, setStation] = useState(
    record?.station ?? recent?.station ?? "",
  );

  return (
    <div className="field-grid">
      <input type="hidden" name="fuel" value={fuel.value} />
      <SuggestionField
        label="Топливо"
        value={fuel.label}
        options={[...options.keys()]}
        maxLength={300}
        onChange={(label) => {
          setFuel({ label, value: label });
          onDirty();
        }}
        onSelect={(label) => {
          // Consumption cycles use the exact stored fuel string.
          setFuel({ label, value: options.get(label) ?? label });
          onDirty();
        }}
      />
      <SuggestionField
        label="АЗС"
        name="station"
        value={station}
        options={stationOptions}
        maxLength={300}
        onChange={(value) => {
          setStation(value);
          onDirty();
        }}
      />
    </div>
  );
}
