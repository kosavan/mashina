import { useSyncExternalStore } from "react";
import english from "./locales/en.json";
import german from "./locales/de.json";

export type Locale = "ru" | "en" | "de";
const catalogs: Record<Exclude<Locale, "ru">, Record<string, string>> = {
  en: english,
  de: german,
};
const listeners = new Set<() => void>();
export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en" || value === "de";
}
let language: Locale = "ru";
try {
  const saved = localStorage.getItem("mashina-locale");
  if (isLocale(saved)) language = saved;
} catch {
  /* Storage may be unavailable in a restricted browser. */
}
export const getLocale = () => language;
export const intlLocale = () =>
  ({ ru: "ru-RU", en: "en-GB", de: "de-DE" })[language];
export function setLocale(value: Locale) {
  language = value;
  try {
    localStorage.setItem("mashina-locale", value);
  } catch {
    /* Keep this session usable. */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = value;
    document.title = {
      ru: "MASHINA — ваш цифровой гараж",
      en: "MASHINA — your digital garage",
      de: "MASHINA — deine digitale Garage",
    }[value];
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale, () => "ru" as Locale);
}

// Exact resources and parameterized server messages only. Never walk the DOM or translate user records.
const patterns = Object.keys(english)
  .filter((key) => /\{\d+\}/.test(key))
  .map((key) => {
    const indices: number[] = [];
    const parts = key.split(/(\{\d+\})/).map((part) => {
      if (/^\{\d+\}$/.test(part)) {
        indices.push(Number(part.slice(1, -1)));
        return "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    return {
      expression: new RegExp("^" + parts.join("") + "$", "s"),
      key,
      indices,
    };
  });
export function tr(key: string, values: readonly unknown[] = []): string {
  const messages = language === "ru" ? {} : catalogs[language];
  let text = language === "ru" ? key : messages[key];
  if (text === undefined) {
    const normalized = key.replace(/\s+/g, " ").trim();
    if (messages[normalized])
      text =
        (key.match(/^\s*/)?.[0] ?? "") +
        messages[normalized] +
        (key.match(/\s*$/)?.[0] ?? "");
  }
  if (text === undefined) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(key);
      if (match) {
        const parameters: string[] = [];
        pattern.indices.forEach((index, i) => {
          parameters[index] = messages[match[i + 1]] ?? match[i + 1];
        });
        return (messages[pattern.key] ?? pattern.key).replace(
          /\{(\d+)\}/g,
          (_, index) => parameters[Number(index)] ?? "",
        );
      }
    }
    text = key;
  }
  return text.replace(/\{(\d+)\}/g, (_, index) =>
    String(values[Number(index)] ?? ""),
  );
}
