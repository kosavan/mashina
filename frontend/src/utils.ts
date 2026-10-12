import type { Entry, State, Vehicle } from "./types";
import { intlLocale, tr } from "./i18n";
export const categories = [
  "Топливо",
  "Плановое ТО",
  "Ремонт",
  "Запчасти",
  "Шины и диски",
  "Страхование",
  "Налоги",
  "Мойка и детейлинг",
  "Парковки и дороги",
  "Штрафы",
  "Аксессуары",
  "Прочее",
];
export const kindNames: Record<string, string> = {
  get expense() {
    return tr("Расход");
  },
  get fuel() {
    return tr("Заправка");
  },
  get maintenance() {
    return tr("ТО / ремонт");
  },
  get odometer() {
    return tr("Пробег");
  },
  get note() {
    return tr("Заметка");
  },
};
export const categoryLabel = (name: string) =>
  categories.includes(name) ? tr(name) : name;
export const number = (
  n: number | null | undefined,
  maximumFractionDigits = 0,
) =>
  n == null
    ? "—"
    : new Intl.NumberFormat(intlLocale(), { maximumFractionDigits }).format(n);
export const money = (minor: number, currency = "RUB") =>
  new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
export const dateLabel = (d: string) =>
  new Intl.DateTimeFormat(intlLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthStart = () => today().slice(0, 7) + "-01";
export const fileURL = (id: string) => `/api/v1/attachments/${id}`;
export const vehicleImage = (v: Vehicle) =>
  v.photo_id ? fileURL(v.photo_id) : v.demo_image ? `/${v.demo_image}` : "";
export const activeEvents = (s: State, id = "") =>
  s.events.filter((e) => !e.deleted && (!id || e.vehicle_id === id));
export function sumEvents(events: Entry[], currency = "RUB") {
  return events
    .filter((e) => e.currency === currency)
    .reduce((sum, e) => sum + e.amount_minor, 0);
}
export function currentKm(v: Vehicle, entries: Entry[]) {
  return Math.max(
    v.purchase_odometer,
    ...entries
      .filter((e) => !e.deleted && e.vehicle_id === v.id && e.odometer != null)
      .map((e) => e.odometer!),
  );
}
export function exactMinor(value: string): bigint {
  if (!/^-?\d+(?:[.,]\d{0,2})?$/.test(value))
    throw new Error("Не более двух знаков после запятой");
  const negative = value[0] === "-";
  const [whole, fraction = ""] = value
    .replace("-", "")
    .replace(",", ".")
    .split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -result : result;
}
export function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.click();
}
