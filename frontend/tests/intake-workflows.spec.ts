import { expect, test, type Page } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.131" } });

async function openMaintenance(page: Page, tab: string) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

test("an offline receipt photo survives reload and an interrupted confirmation saves one expense and attachment", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await openMaintenance(page, "Чеки");
  const before = await (await page.request.get("/api/v1/state")).json();
  const image = {
    name: "synthetic-wash-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYfkAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await context.setOffline(true);
  await page.getByLabel("Добавить фото чека").setInputFiles(image);
  await expect(page.getByText(image.name)).toBeVisible();
  await context.setOffline(false);
  expect(
    (await (await page.request.get("/api/v1/state")).json()).events,
  ).toHaveLength(before.events.length);
  await page.reload();
  await openMaintenance(page, "Чеки");
  await expect(page.getByText(image.name)).toBeVisible();

  await page
    .getByRole("button", { name: "Проверить чек", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сумма", { exact: true }).fill("17.32");
  await dialog
    .getByLabel("Описание", { exact: true })
    .fill("Wash receipt for UI test");
  await page.route("**/api/v1/receipt-inbox/confirm", async (route) => {
    expect((await route.fetch()).ok()).toBeTruthy();
    await route.abort();
  });
  await dialog.getByRole("button", { name: "Подтвердить расход" }).click();
  await expect(
    dialog.getByText("Повторите подтверждение.", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/v1/receipt-inbox/confirm");
  await dialog.getByRole("button", { name: "Подтвердить расход" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(image.name)).toHaveCount(0);
  const after = await (await page.request.get("/api/v1/state")).json();
  const rows = after.events.filter(
    (event: { description: string }) =>
      event.description === "Wash receipt for UI test",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].amount_minor).toBe(1732);
  expect(
    after.attachments.filter(
      (attachment: { event_id: string }) => attachment.event_id === rows[0].id,
    ),
  ).toHaveLength(1);
});

test("history and bank import templates round-trip without importing their source files", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await openMaintenance(page, "Импорт");
  const history = page.locator(".ownership-import");
  const historyFile = {
    name: "fill-ups.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Booked;Litres;Cost;Odometer\n04/01/2025;40,5;58,32;120000\n",
    ),
  };
  await history.locator("input[type=file]").setInputFiles(historyFile);
  await history
    .getByLabel("Дата и время", { exact: true })
    .selectOption("Booked");
  await history.getByLabel("Валюта по умолчанию", { exact: true }).fill("GBP");
  await history.getByLabel("Название шаблона").fill("Fuel history");
  await history
    .getByRole("button", { name: "Сохранить шаблон", exact: true })
    .click();
  await expect(
    history.getByRole("option", { name: "Fuel history" }),
  ).toBeAttached();
  await page.reload();
  await openMaintenance(page, "Импорт");
  await history.locator("input[type=file]").setInputFiles(historyFile);
  await history
    .getByLabel("Шаблоны импорта")
    .selectOption({ label: "Fuel history" });
  await history.getByRole("button", { name: "Применить шаблон" }).click();
  await expect(history.getByLabel("Дата и время", { exact: true })).toHaveValue(
    "Booked",
  );
  await expect(
    history.getByLabel("Валюта по умолчанию", { exact: true }),
  ).toHaveValue("GBP");

  await page
    .getByRole("button", { name: "Проверить выписку", exact: true })
    .click();
  const bank = page.getByRole("dialog");
  const bankFile = {
    name: "bank.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,amount,description\n2025-01-06,-20.03,Wash\n"),
  };
  await bank.getByLabel("Разделитель", { exact: true }).selectOption("comma");
  await bank
    .getByLabel("Банковский CSV", { exact: true })
    .setInputFiles(bankFile);
  await bank.getByRole("button", { name: "Прочитать столбцы" }).click();
  await bank.getByLabel("Дата операции", { exact: true }).selectOption("date");
  await bank
    .getByLabel("Сумма операции", { exact: true })
    .selectOption("amount");
  await bank
    .getByLabel("Описание операции", { exact: true })
    .selectOption("description");
  await bank.getByLabel("Формат даты", { exact: true }).selectOption("iso");
  await bank.getByLabel("Название шаблона").fill("Bank sample");
  await bank
    .getByRole("button", { name: "Сохранить шаблон", exact: true })
    .click();
  await expect(
    bank.getByRole("option", { name: "Bank sample" }),
  ).toBeAttached();
  await bank
    .getByLabel("Разделитель", { exact: true })
    .selectOption("semicolon");
  await bank.getByRole("button", { name: "Применить шаблон" }).click();
  await expect(bank.getByLabel("Разделитель", { exact: true })).toHaveValue(
    "comma",
  );
  await bank.getByRole("button", { name: "Прочитать столбцы" }).click();
  await expect(bank.getByLabel("Дата операции", { exact: true })).toHaveValue(
    "date",
  );
  await expect(bank.getByLabel("Формат даты", { exact: true })).toHaveValue(
    "iso",
  );
});
