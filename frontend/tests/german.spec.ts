import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.71" } });

async function noRussian(page: Page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found = new Set<string>();
    while (walker.nextNode()) {
      const element = walker.currentNode.parentElement;
      const text = walker.currentNode.textContent?.trim() || "";
      if (element?.getClientRects().length && /[а-яё]/i.test(text) && text !== "Русский") found.add(text);
    }
    return [...found];
  });
}

test("German demo covers navigation, forms, body map and language switching", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Имя пользователя", { exact: true }).fill("draft-owner");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("de");
  await expect(page.getByLabel("Benutzername", { exact: true })).toHaveValue("draft-owner");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page).toHaveTitle("MASHINA — deine digitale Garage");
  await page.getByRole("button", { name: "Demo-Garage erkunden" }).click();
  await expect(page.getByRole("heading", { name: "Meine Garage", exact: true })).toBeVisible();
  await page.screenshot({ path: "../.cache/screenshots/garage-de-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Fahrzeug hinzufügen", exact: true }).click();
  expect(await noRussian(page)).toEqual([]);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  for (const type of ["Tankvorgang", "Ausgabe", "Wartung / Reparatur", "Kilometerstand aktualisieren", "Notiz / Ereignis"]) {
    await page.getByRole("button", { name: "Eintrag hinzufügen", exact: true }).click();
    await page.getByRole("button", { name: new RegExp("^" + type + " ") }).click();
    expect(await noRussian(page)).toEqual([]);
    await page.getByRole("button", { name: "Schließen", exact: true }).click();
  }
  await page.getByRole("button", { name: "Volvo XC60 öffnen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Karosserie und Schäden", exact: true })).toBeVisible();
  expect(await noRussian(page)).toEqual([]);
  for (const name of ["Meine Garage", "Verlauf", "Kraftstoff", "Wartung", "Reifen", "Auswertung", "Dokumente", "Erinnerungen", "Einstellungen"]) {
    await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".page-heading")).toBeVisible();
    expect(await noRussian(page)).toEqual([]);
  }
  await expect(page.getByText("Deutsch · ₽ · km · l", { exact: true })).toBeVisible();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("ru");
  await expect(page.getByRole("heading", { name: "Настройки", exact: true })).toBeVisible();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("de");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});

test("German 360px offline expense survives reload and syncs exactly once", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("de");
  await page.getByRole("button", { name: "Demo-Garage erkunden" }).click();
  await expect(page.getByRole("heading", { name: "Meine Garage", exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Meine Garage", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Eintrag hinzufügen", exact: true }).click();
  await page.getByRole("button", { name: /^Ausgabe / }).click();
  await page.getByLabel("Betrag, ₽", { exact: true }).fill("1234.56");
  await page.getByLabel("Beschreibung", { exact: true }).fill("История");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.cache/screenshots/expense-de-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("История", { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/v1/state")).json();
    return state.events.filter((event: { description: string }) => event.description === "История");
  }).toEqual([expect.objectContaining({ amount_minor: 123456, description: "История" })]);
});

test("German setup and offline account preference preserve records and other settings", async ({ page, context }) => {
  const required = (await (await page.request.get("/api/v1/setup")).json()).required;
  if (required) {
    await page.goto("/");
    await page.getByLabel("Язык / Language", { exact: true }).selectOption("de");
    await page.getByLabel("Benutzername", { exact: true }).fill("browser-owner");
    await page.getByLabel("Passwort", { exact: true }).fill("browser-test-password");
    await page.getByLabel(/^Einmaliger Einrichtungscode/).fill("browser-test-bootstrap-only");
    await page.getByRole("button", { name: "Meine Garage erstellen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Meine Garage", exact: true })).toBeVisible();
  } else {
    expect((await page.request.post("/api/v1/login", { data: { username: "browser-owner", password: "browser-test-password" } })).ok()).toBeTruthy();
  }
  const session = await (await page.request.get("/api/v1/session")).json();
  const mutate = (entity: string, data: object) => page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": session.csrf },
    data: { operation_id: randomUUID(), id: randomUUID(), entity, action: "create", data },
  });
  expect((await mutate("settings", { locale: "ru", theme: "light" })).ok()).toBeTruthy();
  expect((await mutate("vehicle", { name: "История" })).ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "История", exact: true }).first()).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  await context.setOffline(true);
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("de");
  await expect(page.getByRole("heading", { name: "Einstellungen", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vollständige Sicherung herunterladen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Design wechseln", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.cache/screenshots/settings-de-mobile-light.png", fullPage: true, animations: "disabled" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByRole("heading", { name: "История", exact: true }).first()).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings).toMatchObject({ locale: "de", theme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  expect((await mutate("settings", { locale: "ru", theme: "dark" })).ok()).toBeTruthy();
});
