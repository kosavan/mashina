import { expect, test } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.87" } });

test("registration records a payment and prefills a renewal reminder", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Регистрация и страховка" })
    .click();
  await page.getByRole("button", { name: "Добавить регистрацию" }).click();
  const dialog = page.getByRole("dialog");
  const expires = new Date(Date.now() + 8 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await dialog.getByLabel("Действует до").fill(expires);
  await dialog.locator("input[name=amount]").fill("123.45");
  await dialog
    .locator("select[name=renewal_inspection]")
    .selectOption("passed");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Скоро истекает", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Пройден", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Напомнить о продлении" }).click();
  await expect(dialog.locator("input[name=due_date]")).toHaveValue(expires);

  await expect
    .poll(async () => {
      const state = await (await page.request.get("/api/v1/state")).json();
      return state.events.find((event: { renewal?: unknown }) => event.renewal);
    })
    .toMatchObject({
      kind: "expense",
      amount_minor: 12345,
      renewal: {
        type: "registration",
        expires_on: expires,
        inspection_status: "passed",
      },
    });
});

test("fuel spreadsheet uses suggested columns and confirms the mapped rows", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  await page.getByRole("tab", { name: "Импорт", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "fill-ups.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date;Litres;Cost;Category;Fuel station;Odometer\n04/01/2026;40,5;58,32;Premium petrol;Browser fuel;120000\n",
    ),
  });
  await expect(page.getByLabel("Дата и время", { exact: true })).toHaveValue(
    "Date",
  );
  await page.getByLabel("Валюта по умолчанию", { exact: true }).fill("GBP");
  await page
    .getByRole("button", { name: "Проверить строки", exact: true })
    .click();
  await page
    .getByLabel("Я проверил исторические показания пробега выбранных строк")
    .check();
  await page
    .getByRole("button", { name: "Подтвердить импорт · 1", exact: true })
    .click();
  await expect(
    page.getByText("Уже импортирована / повтор в файле"),
  ).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  const found = state.events.filter(
    (event: { station?: string }) => event.station === "Browser fuel",
  );
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({
    currency: "GBP",
    amount_minor: 5832,
    category: "Premium petrol",
  });
});
