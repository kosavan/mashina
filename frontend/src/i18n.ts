import { useSyncExternalStore } from "react";
import english from "./locales/en.json";
import german from "./locales/de.json";

export const localeInfo = {
  ru: { name: "Русский", intl: "ru-RU", title: "ваш цифровой гараж" },
  en: { name: "English", intl: "en-GB", title: "your digital garage" },
  de: { name: "Deutsch", intl: "de-DE", title: "deine digitale Garage" },
  zh: { name: "简体中文", intl: "zh-CN", title: "你的数字车库" },
  hi: { name: "हिन्दी", intl: "hi-IN", title: "आपका डिजिटल गैराज" },
  es: { name: "Español", intl: "es-ES", title: "tu garaje digital" },
  ar: { name: "العربية", intl: "ar", title: "مرآبك الرقمي" },
  fr: { name: "Français", intl: "fr-FR", title: "votre garage numérique" },
} as const;
export type Locale = keyof typeof localeInfo;
const catalogs: Partial<Record<Exclude<Locale, "ru">, Record<string, string>>> =
  {
    en: english,
    de: german,
  };
const loaders = {
  zh: () => import("./locales/zh.json"),
  hi: () => import("./locales/hi.json"),
  es: () => import("./locales/es.json"),
  ar: () => import("./locales/ar.json"),
  fr: () => import("./locales/fr.json"),
};
let localeRequest = 0;
const listeners = new Set<() => void>();
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(localeInfo, value);
}
let language: Locale = "ru";
try {
  const saved = localStorage.getItem("mashina-locale");
  if (isLocale(saved)) language = saved;
} catch {
  /* Storage may be unavailable in a restricted browser. */
}
export const getLocale = () => language;
export const intlLocale = () => localeInfo[language].intl;
export async function setLocale(value: Locale) {
  const request = ++localeRequest;
  if (value !== "ru" && !catalogs[value]) {
    catalogs[value] = (await loaders[value as keyof typeof loaders]()).default;
  }
  if (request !== localeRequest) return;
  language = value;
  try {
    localStorage.setItem("mashina-locale", value);
  } catch {
    /* Keep this session usable. */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = value;
    document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
    document.title = "MASHINA — " + localeInfo[value].title;
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
  const messages = language === "ru" ? {} : (catalogs[language] ?? {});
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
