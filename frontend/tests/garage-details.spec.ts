import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { closeDemoSession } from "./demo-session";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.155" } });
test.afterEach(async ({ page }) => closeDemoSession(page));

test("vehicle stock and trips use existing service records, and map consent follows each point", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/v1/session")).json();
  const state = await (await page.request.get("/api/v1/state")).json();
  const car = state.vehicles[0];
  const fixtureDates = ["2025-02-05", "2025-02-06"];
  const fixtureNames = ["Мастерская А", "Мастерская Б"];
  for (const [index, vendor] of fixtureNames.entries()) {
    const inserted = await page.request.post("/api/v1/mutate", {
      headers: { "X-CSRF-Token": session.csrf },
      data: {
        operation_id: randomUUID(),
        id: randomUUID(),
        entity: "event",
        action: "create",
        data: {
          kind: "maintenance",
          vehicle_id: car.id,
          occurred_at: fixtureDates[index],
          vendor,
          description: vendor,
          amount: "60.00",
          currency: "EUR",
          service_latitude: String(53 + index),
          service_longitude: String(37 + index),
        },
      },
    });
    expect(inserted.ok(), await inserted.text()).toBeTruthy();
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Открыть " + car.name, exact: true })
    .click();

  await page.getByRole("button", { name: "Добавить расходник" }).click();
  let form = page.getByRole("dialog");
  await form.getByLabel("Название").fill("Тестовое масло");
  await form.getByLabel("Всего поступило").fill("5");
  await form.getByLabel("Списать на обслуживание").selectOption({
    label: (await form
      .getByRole("option", { name: /Мастерская А/ })
      .textContent())!,
  });
  await form.getByLabel(/Количество списания/).fill("2.5");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText(/В наличии: 2,5/)).toBeVisible();
  await expect(page.getByText("Тестовое масло", { exact: true })).toHaveCount(
    2,
  );

  await page.getByRole("button", { name: "Добавить поездку" }).click();
  form = page.getByRole("dialog");
  await form.getByLabel("Название").fill("Тестовая поездка");
  await form.getByLabel("Начало поездки").fill(fixtureDates[0]);
  await form.getByLabel("Конец поездки").fill(fixtureDates[1]);
  await form.getByLabel("Число участников").fill("2");
  for (const name of fixtureNames) {
    await form.getByRole("checkbox", { name: new RegExp(name) }).check();
  }
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText(/На человека ≈ 60/)).toBeVisible();

  const map = page.locator(".garage-places-map");
  await expect(map).toBeVisible();
  expect((await map.boundingBox())?.width).toBeGreaterThan(200);
  const requests: string[] = [];
  await page.route("https://www.openstreetmap.org/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html></html>",
    });
  });
  await map.getByRole("button", { name: fixtureNames[0], exact: true }).click();
  await page.getByRole("button", { name: /Загрузить карту/ }).click();
  await expect.poll(() => requests.length).toBe(1);
  await map.getByRole("button", { name: fixtureNames[1], exact: true }).click();
  await expect(page.locator("iframe[src*='openstreetmap']")).toHaveCount(0);
  expect(requests).toHaveLength(1);
});
