import { test, expect } from "@playwright/test";

test("maintenance estimate survives offline reload, forecasts once, and clears without an expense", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
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
  await page.getByLabel("Что нужно сделать").fill("Плановый тест масла");
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
    page.getByRole("heading", { name: "Плановый тест масла", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  let state = await (await page.request.get("/api/v1/state")).json();
  let rows = state.reminders.filter(
    (r: any) => r.title === "Плановый тест масла",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].estimated_cost_minor).toBe(123456);
  expect(state.events).toHaveLength(original.events.length);
  await sidebar("Обслуживание");
  await page.getByRole("tab", { name: "Бюджет", exact: true }).click();
  const plan = page.locator(".forecast-panel").first();
  await expect(
    plan.getByText("Плановый тест масла", { exact: false }),
  ).toBeVisible();
  await expect(
    plan
      .locator(".forecast-row")
      .filter({ hasText: "Плановый тест масла" })
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
      name: "Редактировать Плановый тест масла",
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
  await expect(
    page
      .locator(".forecast-panel")
      .first()
      .getByText("Плановый тест масла", { exact: false }),
  ).toHaveCount(0);
  const maintenance = page.locator(".forecast-panel").nth(1);
  await expect(
    maintenance
      .getByRole("button")
      .filter({ hasText: "Плановый тест масла" })
      .getByText("Стоимость не задана", { exact: true }),
  ).toBeVisible();
  state = await (await page.request.get("/api/v1/state")).json();
  rows = state.reminders.filter((r: any) => r.title === "Плановый тест масла");
  expect(rows).toHaveLength(1);
  expect(rows[0].estimated_cost_minor).toBeNull();
  expect(state.events).toHaveLength(original.events.length);
});

test("offline confirmed completion advances the same reminder once without creating mileage or expenses", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  const before = await (await page.request.get("/api/v1/state")).json();
  const reminder = before.reminders.find((r: any) => r.repeat_km > 0);
  const car = before.vehicles.find((v: any) => v.id === reminder.vehicle_id);
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
  await expect(card.locator(".reminder-resource strong")).toContainText("10 000");
  await page.reload();
  await sidebar();
  await expect(card.locator(".reminder-resource strong")).toContainText("10 000");
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
