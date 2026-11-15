import { useState } from "react";
import { SuggestionField } from "./SuggestionField";
import { tr } from "./i18n";
import type { Entry, RecordBase, Vehicle } from "./types";

const fuelGrades = [
  "АИ-92",
  "АИ-95",
  "АИ-98",
  "АИ-100",
  "Дизель",
  "LPG",
  "CNG",
];

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
