import { useSyncExternalStore } from "react";
import english from "./locales/en.json";

export type Locale = "ru" | "en";
const messages: Record<string, string> = english;
const listeners = new Set<() => void>();
export function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en";
}
let language: Locale = "ru";
try {
  const saved = localStorage.getItem("mashina-locale");
  if (isLocale(saved)) language = saved;
} catch {
  /* Storage may be unavailable in a restricted browser. */
}
export const getLocale = () => language;
export const intlLocale = () => (language === "en" ? "en-GB" : "ru-RU");
export function setLocale(value: Locale) {
  language = value;
  try {
    localStorage.setItem("mashina-locale", value);
  } catch {
    /* Keep this session usable. */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = value;
    document.title =
      value === "en"
        ? "MASHINA — your digital garage"
        : "MASHINA — ваш цифровой гараж";
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
const patterns = Object.entries(messages)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
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
      value,
      indices,
    };
  });
export function tr(key: string, values: readonly unknown[] = []): string {
  let text = language === "en" ? messages[key] : key;
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
        return pattern.value.replace(
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
