import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.61" } });

test("bundled fonts respect the production content security policy", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", message => {
    if (message.type() === "error" && /font.*Content Security Policy/i.test(message.text())) blocked.push(message.text());
  });
  await page.goto("/");
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(blocked).toEqual([]);
});

async function untranslated(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const value = node.textContent?.trim() || "";
      if (element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" && /[а-яё]/i.test(value) && value !== "Русский") found.push(value);
    }
    return [...new Set(found)];
  });
}

test("English demo covers navigation and language preference survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Имя пользователя", { exact: true }).fill("draft-owner");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("draft-owner");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
  expect(await untranslated(page)).toEqual([]);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const type of ["Fill-up", "Expense", "Maintenance / repair", "Update odometer", "Note / event"]) {
    await page.getByRole("button", { name: "Add record", exact: true }).click();
    await page.getByRole("button", { name: new RegExp("^" + type + " ") }).click();
    expect(await untranslated(page)).toEqual([]);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  const issues: Record<string, string[]> = {};
  for (const name of ["My garage", "History", "Fuel", "Maintenance", "Tires", "Analytics", "Documents", "Reminders", "Settings"]) {
    await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".page-heading")).toBeVisible();
    await page.waitForTimeout(80);
    issues[name] = await untranslated(page);
  }
  expect(Object.fromEntries(Object.entries(issues).filter(([, values]) => values.length))).toEqual({});
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("ru");
  await expect(page.getByRole("heading", { name: "Настройки", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("English mobile expense keeps user text and syncs once after offline reload", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByRole("button", { name: /^Expense / }).click();
  await page.getByLabel("Amount, ₽", { exact: true }).fill("1234.56");
  // Deliberately collides with a translation resource. User content must stay intact.
  await page.getByLabel("Description", { exact: true }).fill("История");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("История", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/v1/state")).json();
    return state.events.filter((event: { description: string }) => event.description === "История");
  }).toEqual([expect.objectContaining({ amount_minor: 123456, description: "История" })]);
});

test("real account locale changes offline, persists after sync and preserves vehicle names", async ({ page, context }) => {
  // Slower devices exposed an uncached lazy-settings import after going offline.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const setup = await page.request.get("/api/v1/setup");
  const login = await page.request.post((await setup.json()).required ? "/api/v1/setup" : "/api/v1/login", {
    headers: { "X-Forwarded-For": "198.51.100.62" },
    data: { username: "browser-owner", password: "browser-test-password", bootstrap_token: "browser-test-bootstrap-only" },
  });
  expect(login.ok()).toBeTruthy();
  const owner = await login.json();
  await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": owner.csrf },
    data: { operation_id: randomUUID(), id: randomUUID(), entity: "settings", action: "create", data: { locale: "ru" } },
  });
  const created = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": owner.csrf },
    data: { operation_id: randomUUID(), id: randomUUID(), entity: "vehicle", action: "create", data: { name: "История" } },
  });
  expect(created.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "История", exact: true }).first()).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  // The administrator must retain access to backups in either language.
  await expect(page.getByRole("button", { name: "Скачать полный архив", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "История", exact: true }).first()).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings.locale).toBe("en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "История", exact: true }).first()).toBeVisible();
  await page.locator(".sidebar").getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download full backup", exact: true })).toBeVisible();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("ru");
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings.locale).toBe("ru");
  // Deterministically reconnect while the old offline sync request is still failing.
  // The online trigger must be serialized rather than silently discarded.
  await context.setOffline(true);
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/v1/mutate", async route => {
    started();
    await held;
    await route.abort("internetdisconnected");
  }, { times: 1 });
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await requested;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  release();
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings.locale).toBe("en");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("ru");
  await expect.poll(async () => (await (await page.request.get("/api/v1/state")).json()).settings.locale).toBe("ru");
});

test("previously unvisited settings and analytics modules open offline", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.locator(".sidebar").getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("ru");
  await expect(page.getByRole("heading", { name: "Настройки", exact: true })).toBeVisible();
  await page.locator(".sidebar").getByRole("button", { name: "Аналитика", exact: true }).click();
  await expect(page.locator(".page-heading")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const locale of ["en", "ru"] as const) {
  test(`localized README screenshots use one car (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.getByLabel("Язык / Language", { exact: true }).selectOption(locale);
    await page.getByRole("button", { name: locale === "en" ? "Explore the demo garage" : "Посмотреть демогараж" }).click();
    await expect(page.getByRole("heading", { name: locale === "en" ? "My garage" : "Мой гараж", exact: true })).toBeVisible();
    await page.screenshot({ path: `../.cache/screenshots/garage-${locale}.png`, fullPage: true });
    await page.locator(".vehicle-grid").screenshot({ path: `../.cache/screenshots/garage-cards-${locale}.png`, style: ".desktop-fab { visibility: hidden; }" });
    await page.locator(".sidebar").getByRole("button", { name: locale === "en" ? "Analytics" : "Аналитика", exact: true }).click();
    const select = page.locator(".analytics-filters select").first();
    const car = await page.locator('select[aria-label]').filter({ has: page.locator('option', { hasText: 'Volvo XC60' }) }).first().locator('option').filter({ hasText: 'Volvo XC60' }).getAttribute('value');
    await select.selectOption(car!);
    await expect(select).toHaveValue(car!);
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `../.cache/screenshots/analytics-${locale}.png`, fullPage: true });
    if (locale === "en") expect(await untranslated(page)).toEqual([]);
  });
}
