import catalogData from "./vehicleCatalog.json";
import type { RecordBase } from "./types";

const catalog: Record<string, Record<string, string[]>> = catalogData;
const aliases: Record<string, string> = {
  skoda: "Škoda",
  шкода: "Škoda",
  лада: "LADA",
  ваз: "LADA",
  lada: "LADA",
  citroen: "Citroën",
  mercedes: "Mercedes-Benz",
  мерседес: "Mercedes-Benz",
  вольво: "Volvo",
  тойота: "Toyota",
  фольксваген: "Volkswagen",
  uaz: "УАЗ",
};
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function catalogMake(value: string) {
  return (
    (Object.hasOwn(aliases, normalize(value))
      ? aliases[normalize(value)]
      : undefined) ||
    Object.keys(catalog).find((make) => normalize(make) === normalize(value)) ||
    value
  );
}
function unique(values: string[]) {
  return Array.from(
    new Map(
      values.filter(Boolean).map((value) => [normalize(value), value]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));
}
export function vehicleSuggestions(
  field: "brand" | "model" | "engine",
  brand: string,
  model: string,
  saved: RecordBase[],
) {
  const make = catalogMake(brand);
  const matching = saved.filter(
    (car) =>
      normalize(catalogMake(String(car.brand || ""))) === normalize(make),
  );
  const models = Object.hasOwn(catalog, make) ? catalog[make] : {};
  const modelKey = Object.keys(models).find(
    (key) => normalize(key) === normalize(model),
  );
  if (field === "brand")
    return unique([
      ...Object.keys(catalog),
      ...saved.map((car) => String(car.brand || "")),
    ]);
  if (field === "model")
    return unique([
      ...Object.keys(models),
      ...matching.map((car) => String(car.model || "")),
    ]);
  return unique([
    ...(modelKey ? models[modelKey] : []),
    ...matching
      .filter((car) => normalize(String(car.model || "")) === normalize(model))
      .map((car) => String(car.engine || "")),
  ]);
}
