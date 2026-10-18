import { afterEach, describe, expect, it } from "vitest";
import { getLocale, isLocale, setLocale, tr } from "./i18n";
import {
  categories,
  categoryLabel,
  dateLabel,
  money,
  kindNames,
} from "./utils";
import { localizeDemo } from "./demoLocale";
import type { State } from "./types";
import english from "./locales/en.json";
import german from "./locales/de.json";
import demoEnglish from "./locales/demo.json";
import demoGerman from "./locales/demo.de.json";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

afterEach(() => setLocale("ru"));
describe("interface language", () => {
  it("supports only explicit languages and preserves default Russian", () => {
    expect(getLocale()).toBe("ru");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("ja")).toBe(false);
    expect(tr("Добавить автомобиль")).toBe("Добавить автомобиль");
  });
  it("translates UI, parameters and dates while preserving units and canonical categories", () => {
    setLocale("en");
    expect(tr("Открыть {0}", ["Моя машина"])).toBe("Open Моя машина");
    expect(categoryLabel("Топливо")).toBe("Fuel");
    expect(categories[0]).toBe("Топливо");
    expect(categoryLabel("Моя категория")).toBe("Моя категория");
    expect(kindNames.expense).toBe("Expense");
    expect(dateLabel("2026-01-15")).toContain("Jan");
    expect(money(10001)).toContain("100.01");
    expect(tr("Неверное имя или пароль")).not.toMatch(/[а-яё]/i);
  });
  it("switches German resources and formats without translating supplied user text", () => {
    setLocale("de");
    expect(tr("Мой гараж")).toBe("Meine Garage");
    expect(tr("Открыть {0}", ["История"])).toBe("История öffnen");
    expect(tr("Имя пользователя: от 3 до 20 символов")).toBe(
      "Benutzername: von 3 bis 20 Zeichen",
    );
    expect(tr("  Сохранить  ")).toBe("  Speichern  ");
    expect(categoryLabel("Топливо")).toBe("Kraftstoff");
    expect(categoryLabel("Моя категория")).toBe("Моя категория");
    expect(kindNames.expense).toBe("Ausgabe");
    expect(dateLabel("2026-03-15")).toContain("März");
    expect(money(10001, "EUR")).toContain("100,01");
    setLocale("en");
    expect(tr("Мой гараж")).toBe("My garage");
    setLocale("ru");
    expect(tr("Мой гараж")).toBe("Мой гараж");
  });
  it("provides complete German resources with the same parameter contract", () => {
    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
    for (const [key, value] of Object.entries(german)) {
      expect(value.trim(), key).not.toBe("");
      expect(value.match(/\{\d+\}/g)?.sort() ?? [], key).toEqual(
        key.match(/\{\d+\}/g)?.sort() ?? [],
      );
      if (key !== "Язык / Language") expect(value, key).not.toMatch(/[а-яё]/i);
    }
    expect(Object.keys(demoGerman).sort()).toEqual(
      Object.keys(demoEnglish).sort(),
    );
  });
  for (const locale of ["zh", "hi", "es", "ar", "fr"] as const) {
    it(`has complete ${locale} resources and preserves user text after loading`, async () => {
      const catalog: Record<string, string> = JSON.parse(
        readFileSync(`src/locales/${locale}.json`, "utf8"),
      );
      const demo = JSON.parse(
        readFileSync(`src/locales/demo.${locale}.json`, "utf8"),
      );
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(english).sort());
      expect(Object.keys(demo).sort()).toEqual(Object.keys(demoEnglish).sort());
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.trim(), key).not.toBe("");
        expect(value.match(/\{\d+\}/g)?.sort() ?? [], key).toEqual(
          key.match(/\{\d+\}/g)?.sort() ?? [],
        );
        if (key !== "Язык / Language")
          expect(value, key).not.toMatch(/[а-яё]/i);
      }
      await setLocale(locale);
      expect(tr("Мой гараж")).toBe(catalog["Мой гараж"]);
      expect(tr("Открыть {0}", ["История"])).toContain("История");
      expect(categoryLabel("Моя категория")).toBe("Моя категория");
      expect(money(123456, "EUR")).not.toBe("");
    });
  }
  it("does not rewrite demo storage or canonical finance fields", () => {
    const state = {
      vehicles: [{ name: "Volvo XC60", drive: "Полный" }],
      events: [
        {
          description: "Бережная мойка кузова",
          category: "Мойка и детейлинг",
          amount_minor: 123,
        },
      ],
      categories: [{ name: "Моя категория" }],
    } as unknown as State;
    setLocale("en");
    const localized = localizeDemo(state);
    expect(localized.events[0].description).not.toMatch(/[а-яё]/i);
    expect(localized.events[0].category).toBe(state.events[0].category);
    expect(localized.events[0].amount_minor).toBe(123);
    expect(state.events[0].description).toBe("Бережная мойка кузова");
    expect(localized.categories[0].name).toBe("Моя категория");
    setLocale("de");
    const germanDemo = localizeDemo(state);
    expect(germanDemo.events[0].description).toBe("Schonende Außenwäsche");
    expect(germanDemo.vehicles[0].drive).toBe("Allradantrieb");
    expect(germanDemo.events[0].category).toBe(state.events[0].category);
    expect(germanDemo.events[0].amount_minor).toBe(123);
    expect(state.events[0].description).toBe("Бережная мойка кузова");
  });
  it("has an English resource for each explicit static message", () => {
    const missing = new Set<string>();
    for (const name of readdirSync("src").filter((name) =>
      name.endsWith(".tsx"),
    )) {
      const source = ts.createSourceFile(
        name,
        readFileSync("src/" + name, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === "tr" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (
            /[а-яё]/i.test(key) &&
            !(key in english) &&
            !(key.replace(/\s+/g, " ").trim() in english)
          )
            missing.add(key);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect([...missing]).toEqual([]);
  });
});
