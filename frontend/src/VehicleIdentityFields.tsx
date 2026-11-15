import { useState } from "react";
import { SuggestionField } from "./SuggestionField";
import { tr } from "./i18n";
import { vehicleSuggestions } from "./vehicleCatalog";
import type { RecordBase } from "./types";

export function VehicleIdentityFields({
  record,
  vehicles,
  onDirty,
}: {
  record?: RecordBase;
  vehicles: RecordBase[];
  onDirty: () => void;
}) {
  const [brand, setBrand] = useState(String(record?.brand || ""));
  const [model, setModel] = useState(String(record?.model || ""));
  const [engine, setEngine] = useState(String(record?.engine || ""));
  return (
    <>
      <div className="field-grid vehicle-identity-grid">
        <SuggestionField
          name="brand"
          label="Марка"
          value={brand}
          options={vehicleSuggestions("brand", brand, model, vehicles)}
          onChange={(value) => {
            if (value !== brand) {
              onDirty();
              setBrand(value);
              setModel("");
              setEngine("");
            }
          }}
        />
        <SuggestionField
          name="model"
          label="Модель"
          value={model}
          options={vehicleSuggestions("model", brand, model, vehicles)}
          onChange={(value) => {
            if (value !== model) {
              onDirty();
              setModel(value);
              setEngine("");
            }
          }}
        />
        <SuggestionField
          name="engine"
          label="Двигатель"
          value={engine}
          options={vehicleSuggestions("engine", brand, model, vehicles)}
          onChange={(value) => {
            onDirty();
            setEngine(value);
          }}
        />
      </div>
      <p className="field-help">
        {tr(
          "Выберите из подсказок или введите вручную. Двигатели разных поколений и рынков собраны вместе — проверьте свой вариант по документам.",
        )}
      </p>
    </>
  );
}
