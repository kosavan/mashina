import {
  test,
  expect,
  request as apiRequest,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

let cookies: any[] = [];
let csrf = "";
test.beforeAll(async () => {
  const request = await apiRequest.newContext({
    baseURL: "http://127.0.0.1:8000",
  });
  const setup = await (await request.get("/api/v1/setup")).json();
  const login = await request.post(
    setup.required ? "/api/v1/setup" : "/api/v1/login",
    {
      data: {
        username: "browser-owner",
        password: "browser-test-password",
        bootstrap_token: "browser-test-bootstrap-only",
      },
    },
  );
  expect(login.ok()).toBeTruthy();
  csrf = (await login.json()).csrf;
  cookies = (await request.storageState()).cookies;
  await request.dispose();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});

async function create(
  page: Page,
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
async function openImport(page: Page, car: string) {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .evaluate((el: HTMLButtonElement) => el.click());
  await page.getByRole("tab", { name: "Импорт", exact: true }).click();
  await page.getByLabel("Автомобиль инструментов").selectOption(car);
  await page
    .getByRole("button", { name: "Проверить выписку", exact: true })
    .click();
}
async function mapFile(page: Page, content: string, sourceName: string) {
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Разделитель", { exact: true }).selectOption("comma");
  await sheet
    .getByLabel("Банковский CSV", { exact: true })
    .setInputFiles({
      name: "synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(content),
    });
  await sheet.getByRole("button", { name: "Прочитать столбцы" }).click();
  await sheet.getByLabel("Дата операции", { exact: true }).selectOption("date");
  await sheet
    .getByLabel("Сумма операции", { exact: true })
    .selectOption("amount");
  await sheet
    .getByLabel("Описание операции", { exact: true })
    .selectOption("description");
  await sheet
    .getByLabel("ID операции банка", { exact: true })
    .selectOption("id");
  await sheet.getByLabel("Формат даты", { exact: true }).selectOption("iso");
  await sheet
    .getByLabel("Личный источник выписки", { exact: true })
    .selectOption("");
  await sheet
    .getByLabel("Название источника", { exact: true })
    .fill(sourceName);
  await sheet.getByRole("button", { name: "Показать операции" }).click();
  await expect(
    sheet.getByRole("heading", { name: "Проверьте каждую операцию" }),
  ).toBeVisible();
}

test("mobile bank mapping links fuel, creates once, and retries a lost response safely", async ({
  page,
}) => {
  const car = await create(page, "vehicle", { name: "Bank " + randomUUID() });
  const fuel = await create(page, "event", {
    vehicle_id: car.id,
    kind: "fuel",
    occurred_at: "2026-10-01",
    odometer: 100,
    liters: "10",
    price: "10.001",
    description: "Existing fuel",
  });
  const content =
    "date,amount,description,id,private\n2026-10-01,-100.01,Fuel,F,UNMAPPED_SECRET\n2026-10-02,-250.25,Wash,W,UNMAPPED_SECRET\n";
  const sourceName = "Synthetic " + randomUUID();
  await openImport(page, car.id);
  await mapFile(page, content, sourceName);
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("button", { name: "Проверить итог" }),
  ).toBeDisabled();
  await expect(
    sheet.getByText("UNMAPPED_SECRET", { exact: false }),
  ).toHaveCount(0);
  await sheet
    .getByLabel("Решение для операции 1", { exact: true })
    .selectOption(fuel.id);
  await sheet
    .getByLabel("Решение для операции 2", { exact: true })
    .selectOption("create");
  await sheet.getByLabel("Категория операции 2", { exact: true }).fill("Мойка");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await sheet.evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: "../.cache/screenshots/bank-review-dark.png" });
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.screenshot({
    path: "../.cache/screenshots/bank-review-light.png",
  });
  await sheet.getByRole("button", { name: "Проверить итог" }).click();
  let dropped = false;
  await page.route("**/api/v1/bank/commit", async (route) => {
    const response = await route.fetch();
    if (!dropped) {
      dropped = true;
      await route.abort("connectionfailed");
    } else await route.fulfill({ response });
  });
  await sheet.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(sheet.getByRole("alert")).toBeVisible();
  await sheet.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(
    sheet.getByRole("heading", { name: "История обновлена" }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  const events = state.events.filter((e: any) => e.vehicle_id === car.id);
  expect(events).toHaveLength(2);
  expect(events.reduce((n: number, e: any) => n + e.amount_minor, 0)).toBe(
    35026,
  );
  expect(events.find((e: any) => e.id === fuel.id).version).toBe(1);
  await sheet.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("button", { name: "Проверить выписку", exact: true })
    .click();
  await mapFile(page, content, sourceName);
  await expect(
    sheet.getByText("Уже подтверждено — повторного расхода не будет", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(
    sheet.getByRole("button", { name: "Проверить итог" }),
  ).toBeDisabled();
});

test("paginated review preserves decisions offline and rejects a stale match atomically", async ({
  page,
  context,
}) => {
  const car = await create(page, "vehicle", {
    name: "Bank pages " + randomUUID(),
  });
  const event = await create(page, "event", {
    vehicle_id: car.id,
    kind: "expense",
    amount: "100.01",
    occurred_at: "2026-10-01",
    description: "Original",
  });
  const content =
    "date,amount,description,id\n2026-10-01,-100.01,Match,1\n" +
    Array.from(
      { length: 50 },
      (_, i) => `2026-10-01,-1,Other ${i},${i + 2}\n`,
    ).join("");
  await openImport(page, car.id);
  await mapFile(page, content, "Pages " + randomUUID());
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator(".bank-row")).toHaveCount(50);
  await sheet
    .getByLabel("Решение для операции 1", { exact: true })
    .selectOption(event.id);
  await sheet.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(sheet.locator(".bank-row")).toHaveCount(1);
  await sheet
    .getByLabel("Решение для операции 51", { exact: true })
    .selectOption("create");
  await sheet.getByRole("button", { name: "Проверить итог" }).click();
  await context.setOffline(true);
  await expect(
    sheet.getByRole("button", { name: "Подтвердить импорт" }),
  ).toBeDisabled();
  await expect(
    sheet.getByText("Нет подключения.", { exact: false }),
  ).toBeVisible();
  await context.setOffline(false);
  const changed = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      entity: "event",
      action: "update",
      id: event.id,
      operation_id: randomUUID(),
      expected_version: 1,
      data: { amount: "99" },
    },
  });
  expect(changed.ok()).toBeTruthy();
  await sheet.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Совпадение изменилось");
  let state = await (await page.request.get("/api/v1/state")).json();
  expect(state.events.filter((e: any) => e.vehicle_id === car.id)).toHaveLength(
    1,
  );
  await sheet.getByRole("button", { name: "К операциям" }).click();
  await expect(
    sheet.getByLabel("Решение для операции 51", { exact: true }),
  ).toHaveValue("create");
  await sheet.getByRole("button", { name: "Назад", exact: true }).click();
  await sheet
    .getByLabel("Решение для операции 1", { exact: true })
    .selectOption("ignore");
  await sheet.getByRole("button", { name: "Проверить итог" }).click();
  await sheet.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(
    sheet.getByRole("heading", { name: "История обновлена" }),
  ).toBeVisible();
  state = await (await page.request.get("/api/v1/state")).json();
  expect(state.events.filter((e: any) => e.vehicle_id === car.id)).toHaveLength(
    2,
  );
});
