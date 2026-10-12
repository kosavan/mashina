import { test, expect, request as apiRequest } from "@playwright/test";
import { randomUUID } from "node:crypto";
let cookies: any[] = [];
let csrf = "";
test.beforeAll(async () => {
  const request = await apiRequest.newContext({
    baseURL: "http://127.0.0.1:8000",
  });
  const setup = await (await request.get("/api/v1/setup")).json();
  const response = await request.post(
    setup.required ? "/api/v1/setup" : "/api/v1/login",
    {
      data: {
        username: "browser-owner",
        password: "browser-test-password",
        bootstrap_token: "browser-test-bootstrap-only",
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  csrf = (await response.json()).csrf;
  cookies = (await request.storageState()).cookies;
  await request.dispose();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});
async function create(
  page: any,
  entity: string,
  data: Record<string, unknown>,
) {
  const response = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      entity,
      action: "create",
      id: randomUUID(),
      operation_id: randomUUID(),
      data,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).record;
}

test("maintenance estimate survives offline reload, forecasts once, and clears without an expense", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const car = await create(page, "vehicle", {
    name: "Forecast " + randomUUID(),
    purchase_odometer: 10000,
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  const original = await (await page.request.get("/api/v1/state")).json();
  const sidebar = (name: string) =>
    page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
  await sidebar("Напоминания");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Новое напоминание" }).click();
  await page.getByRole("dialog").getByRole("combobox").first().selectOption(car.id);
  const title = "Плановый тест масла " + randomUUID().slice(0, 8);
  await page.getByLabel("Что нужно сделать").fill(title);
  const day = new Date().toISOString().slice(0, 10);
  await page.getByLabel("К дате", { exact: true }).fill(day);
  await page
    .getByText("Плановая стоимость обслуживания", { exact: true })
    .click();
  await page
    .getByLabel("Ориентировочная стоимость", { exact: true })
    .fill("1234.56");
  await page.getByLabel("Валюта оценки", { exact: true }).fill("RUB");
  await page.screenshot({
    path: "../.cache/screenshots/service-estimate-form.png",
  });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await sidebar("Напоминания");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  let state = await (await page.request.get("/api/v1/state")).json();
  let rows = state.reminders.filter((r: any) => r.title === title);
  expect(rows).toHaveLength(1);
  expect(rows[0].estimated_cost_minor).toBe(123456);
  expect(state.events).toHaveLength(original.events.length);
  await sidebar("Обслуживание");
  await page.getByRole("tab", { name: "Бюджет", exact: true }).click();
  await page.getByLabel("Автомобиль инструментов").selectOption(car.id);
  const plan = page.locator(".forecast-panel").first();
  await expect(plan.getByText(title, { exact: false })).toBeVisible();
  await expect(
    plan
      .locator(".forecast-row")
      .filter({ hasText: title })
      .getByText("Оценка ТО", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.cache/screenshots/service-forecast-mobile.png",
    fullPage: true,
  });
  await sidebar("Напоминания");
  await page
    .getByRole("button", {
      name: `Редактировать ${title}`,
      exact: true,
    })
    .click();
  await page.getByLabel("Ориентировочная стоимость", { exact: true }).fill("");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await sidebar("Обслуживание");
  await page.getByRole("tab", { name: "Бюджет", exact: true }).click();
  await page.getByLabel("Автомобиль инструментов").selectOption(car.id);
  await expect(
    page.locator(".forecast-panel").first().getByText(title, { exact: false }),
  ).toHaveCount(0);
  const maintenance = page.locator(".forecast-panel").nth(1);
  await expect(
    maintenance
      .getByRole("button")
      .filter({ hasText: title })
      .getByText("Стоимость не задана", { exact: true }),
  ).toBeVisible();
  state = await (await page.request.get("/api/v1/state")).json();
  rows = state.reminders.filter((r: any) => r.title === title);
  expect(rows).toHaveLength(1);
  expect(rows[0].estimated_cost_minor).toBeNull();
  expect(state.events).toHaveLength(original.events.length);
});

test("offline confirmed completion advances the same reminder once without creating mileage or expenses", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const car = await create(page, "vehicle", {
    name: "Completion " + randomUUID(),
    purchase_odometer: 10000,
  });
  const reminder = await create(page, "reminder", {
    vehicle_id: car.id,
    title: "Oil " + randomUUID(),
    due_date: "2026-10-20",
    due_odometer: 10750,
    repeat_km: 10000,
    repeat_days: 365,
    estimated_cost: "12500",
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  const before = await (await page.request.get("/api/v1/state")).json();
  const current = before.vehicles.find((v: any) => v.id === car.id);
  car.current_odometer = current.current_odometer;
  const sidebar = () =>
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Напоминания", exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
  await sidebar();
  await context.setOffline(true);
  const card = page
    .locator(".reminder-card")
    .filter({ hasText: car.name })
    .filter({ hasText: reminder.title });
  await card.getByRole("button", { name: "Выполнено", exact: true }).click();
  await page
    .getByLabel("Подтверждённый пробег, км")
    .fill(String(car.current_odometer));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card.locator(".reminder-resource strong")).toContainText(
    "10 000",
  );
  await page.reload();
  await sidebar();
  await expect(card.locator(".reminder-resource strong")).toContainText(
    "10 000",
  );
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const after = await (await page.request.get("/api/v1/state")).json();
  const next = after.reminders.find((r: any) => r.id === reminder.id);
  expect(next.version).toBe(reminder.version + 1);
  expect(next.due_odometer).toBe(car.current_odometer + 10000);
  expect(next.estimated_cost_minor).toBe(reminder.estimated_cost_minor);
  expect(after.events).toHaveLength(before.events.length);
  expect(
    after.vehicles.find((v: any) => v.id === car.id).current_odometer,
  ).toBe(car.current_odometer);
});
