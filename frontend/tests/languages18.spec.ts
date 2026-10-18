import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.181" } });
test.afterEach(async ({ page, context }) => {
  await context.setOffline(false);
  const response = await page.request.get("/api/v1/session");
  if (response.ok()) {
    const session = await response.json();
    if (session.demo) await page.request.post("/api/v1/logout", { headers: { "X-CSRF-Token": session.csrf } });
  }
});

test("unvisited language catalogs switch offline and preserve the final account preference", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Settings", exact: true }).click();
  await context.setOffline(true);
  for (const locale of ["zh", "hi", "es", "ar", "fr"]) {
    const dictionary = JSON.parse(readFileSync(`src/locales/${locale}.json`, "utf8"));
    await page.getByLabel("Язык / Language", { exact: true }).selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: dictionary["Настройки"], exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await context.setOffline(false);
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings.locale).toBe("fr");
});

for (const locale of ["zh", "hi", "es", "ar", "fr"]) {
  test(`${locale} mobile demo, RTL, forms and offline language reload`, async ({ page, context }) => {
    const dictionary = JSON.parse(readFileSync(`src/locales/${locale}.json`, "utf8"));
    const t = (key: string) => dictionary[key] as string;
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.getByLabel("Язык / Language", { exact: true }).selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await page.getByRole("button", { name: t("Посмотреть демогараж"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("Мой гараж"), exact: true })).toBeVisible();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.getByRole("heading", { name: t("Мой гараж"), exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("button", { name: t("Добавить запись"), exact: true }).click();
    await page.getByRole("button", { name: new RegExp("^" + t("Расход") + " ") }).click();
    await page.getByLabel(t("Сумма, ₽"), { exact: true }).fill("123.45");
    await page.getByLabel(t("Описание"), { exact: true }).fill("История " + locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: t("Сохранить"), exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("История " + locale, { exact: true }).first()).toBeVisible();
    await context.setOffline(false);
    await expect.poll(async () => {
      const state = await (await page.request.get("/api/v1/state")).json();
      return state.events.filter((e: { description: string }) => e.description === "История " + locale);
    }).toEqual([expect.objectContaining({ amount_minor: 12345 })]);
    await page.getByRole("button", { name: t("Открыть меню"), exact: true }).click();
    await page.locator(".sidebar").getByRole("button", { name: t("Настройки"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("Настройки"), exact: true })).toBeVisible();
    await page.screenshot({ path: `../.cache/screenshots/language-${locale}-360.png`, fullPage: true, animations: "disabled" });
  });
}
