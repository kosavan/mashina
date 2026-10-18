import type { State } from "./types";
import fixture from "./locales/demo.json";
import german from "./locales/demo.de.json";
import { getLocale } from "./i18n";

// Only the isolated fictional fixture is projected. Real user records are never translated.
export function localizeDemo(state: State): State {
  if (getLocale() === "ru") return state;
  const demoMessages: Record<string, string> =
    getLocale() === "de" ? german : fixture;
  function visit(value: unknown, key = ""): unknown {
    if (key === "categories" || key === "category") return value;
    if (typeof value === "string") return demoMessages[value] ?? value;
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, visit(item, name)]),
      );
    return value;
  }
  return visit(state) as State;
}
