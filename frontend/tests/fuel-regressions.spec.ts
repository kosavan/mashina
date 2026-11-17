import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.185" } });
test.afterEach(async ({ page, context }) => {
  await context.setOffline(false);
  const session = await (await page.request.get("/api/v1/session")).json();
  if (session.demo) await page.request.post("/api/v1/logout", { headers: { "X-CSRF-Token": session.csrf } });
});

test("same-time imported fills retain both cycles and fractional prices survive offline editing", async ({ page, context }) => {
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.locator(".vehicle-grid")).toBeVisible();
  const session = await (await page.request.get("/api/v1/session")).json();
  const mutate = async (entity: string, data: object) => {
    const response = await page.request.post("/api/v1/mutate", {
      headers: { "X-CSRF-Token": session.csrf },
      data: { operation_id: randomUUID(), id: randomUUID(), entity, action: "create", data },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()).record;
  };
  await mutate("settings", { locale: "en", distance_unit: "mi", currency: "GBP" });
  const car = await mutate("vehicle", { name: "UK fuel regression", currency: "GBP", purchase_odometer: 1000 });
  // Reverse insertion order reproduces date-only CSV history without changing its records.
  for (const [odometer, liters] of [[1500, "15"], [1200, "10"], [1000, "20"]] as const) {
    await mutate("event", { vehicle_id: car.id, kind: "fuel", occurred_at: "2026-01-19", odometer,
      liters, price: "1.759", currency: "GBP", fuel: "Petrol", full: true, odometer_confirmed: true,
      description: `Imported fill ${odometer}` });
  }
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Fuel", exact: true }).click();
  await page.getByRole("combobox", { name: "Vehicle", exact: true }).selectOption(car.id);
  await page.getByRole("button", { name: "Edit Imported fill 1500", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const price = dialog.getByLabel("Price per liter, £", { exact: true });
  await expect(price).toHaveValue("1.759");
  expect(await price.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Imported fill 1500", exact: true }).click();
  await price.fill("1.769");
  await dialog.getByLabel("Amount, £", { exact: true }).fill("");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".vehicle-grid")).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/v1/state")).json();
    return state.events.find((e: { description: string }) => e.description === "Imported fill 1500");
  }).toMatchObject({ price: "1.769", amount_minor: 2654 });
  await page.locator(".sidebar").getByRole("button", { name: "Fuel", exact: true }).click();
  await page.getByRole("button", { name: "Charts & consumption" }).click();
  await page.getByRole("combobox", { name: "Vehicle for analytics" }).selectOption(car.id);
  const rows = page.locator(".cycle-list > div");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("1,000 → 1,200");
  await expect(rows.nth(1)).toContainText("1,200 → 1,500");
  await expect(rows.nth(0)).toContainText("mi");
  await expect(rows.nth(1)).toContainText("300");
  for (const theme of ["dark", "light"]) {
    if (theme === "light") await page.getByRole("button", { name: "Switch theme" }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(rows.nth(1).locator(".cycle-reading")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../.cache/screenshots/fuel-regression-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});
