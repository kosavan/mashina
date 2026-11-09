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
export const CURRENCIES = [
  "RUB",
  "USD",
  "EUR",
  "GBP",
  "CNY",
  "INR",
  "KZT",
  "BYN",
  "TRY",
  "AED",
  "CHF",
  "CAD",
  "AUD",
  "PLN",
  "BRL",
] as const;
export const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
  INR: "₹",
  KZT: "₸",
  BYN: "Br",
  TRY: "₺",
  AED: "AED",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
  PLN: "zł",
  BRL: "R$",
};
export type DistanceUnit = "km" | "mi";
export type VolumeUnit = "l" | "gal_us" | "gal_uk";
export type ConsumptionUnit =
  "l_100km" | "mpg_uk" | "mpg_us" | "km_l" | "l_100mi";
export const currencySymbol = (code = "RUB") => CURRENCY_SYMBOLS[code] || code;
export const defaultCurrency = (s: State, v?: Vehicle | null) =>
  v?.currency ||
  (typeof s.settings.currency === "string" && s.settings.currency) ||
  "RUB";
export const distanceUnit = (s: State): DistanceUnit =>
  s.settings.distance_unit === "mi" ? "mi" : "km";
export const volumeUnit = (s: State): VolumeUnit =>
  s.settings.volume_unit === "gal_us" || s.settings.volume_unit === "gal_uk"
    ? (s.settings.volume_unit as VolumeUnit)
    : "l";
export const consumptionUnit = (s: State): ConsumptionUnit =>
  s.settings.consumption_unit === "mpg_uk" ||
  s.settings.consumption_unit === "mpg_us" ||
  s.settings.consumption_unit === "km_l" ||
  s.settings.consumption_unit === "l_100mi"
    ? (s.settings.consumption_unit as ConsumptionUnit)
    : "l_100km";
export const distanceShort = (u: DistanceUnit) => tr(u === "mi" ? "ми" : "км");
export const volumeShort = (u: VolumeUnit) =>
  tr(u === "gal_us" || u === "gal_uk" ? "гал" : "л");
export const consumptionShort = (u: ConsumptionUnit) =>
  u === "mpg_uk"
    ? "mpg (UK)"
    : u === "mpg_us"
      ? "mpg (US)"
      : u === "km_l"
        ? tr("км/л")
        : u === "l_100mi"
          ? tr("л / 100 ми")
          : tr("л / 100 км");
export const number = (
  n: number | null | undefined,
  maximumFractionDigits = 0,
) =>
  n == null
    ? "—"
    : new Intl.NumberFormat(intlLocale(), { maximumFractionDigits }).format(n);
export const money = (minor: number, currency = "RUB") => {
  try {
    return new Intl.NumberFormat(intlLocale(), {
      style: "currency",
      currency,
      maximumFractionDigits: minor % 100 ? 2 : 0,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(minor % 100 ? 2 : 0)} ${currency}`;
  }
};
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
export const vehicleImage = (v: Vehicle, card = false) =>
  v.photo_id
    ? fileURL(v.photo_id) + (card ? "?variant=card" : "")
    : v.demo_image
      ? `/${v.demo_image}`
      : "";
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
