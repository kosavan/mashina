import { test, expect } from "@playwright/test";

async function demo(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Volvo XC60", exact: true }),
  ).toBeVisible();
}

test("demo, analytics, documents and isolated reset", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page.screenshot({
    path: "../.cache/screenshots/garage-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".vehicle-grid")
    .screenshot({ path: "../.cache/screenshots/garage-cards.png", style: ".desktop-fab { visibility: hidden; }" });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Аналитика", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Расходы по месяцам" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.screenshot({
    path: "../.cache/screenshots/analytics-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Документы", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Важные бумаги — всегда рядом" }),
  ).toBeVisible();
  const originalDemo = await (await page.request.get("/api/v1/state")).json();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  await page.getByRole("tab", { name: "Импорт", exact: true }).click();
  await page
    .getByRole("button", { name: "Проверить выписку", exact: true })
    .click();
  const bank = page.getByRole("dialog");
  await bank.getByLabel("Банковский CSV", { exact: true }).setInputFiles({
    name: "invented-demo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Дата;Сумма;Описание;ID\n01.10.2026;-1,23;Демонстрационная мойка;demo-bank-1\n",
    ),
  });
  await bank.getByRole("button", { name: "Прочитать столбцы" }).click();
  await bank.getByLabel("Дата операции", { exact: true }).selectOption("Дата");
  await bank
    .getByLabel("Сумма операции", { exact: true })
    .selectOption("Сумма");
  await bank
    .getByLabel("Описание операции", { exact: true })
    .selectOption("Описание");
  await bank
    .getByLabel("ID операции банка", { exact: true })
    .selectOption("ID");
  await bank
    .getByLabel("Название источника", { exact: true })
    .fill("Вымышленный банк");
  await bank.getByRole("button", { name: "Показать операции" }).click();
  await bank
    .getByLabel("Решение для операции 1", { exact: true })
    .selectOption("create");
  await bank.getByRole("button", { name: "Проверить итог" }).click();
  await bank.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(
    bank.getByRole("heading", { name: "История обновлена" }),
  ).toBeVisible();
  const updatedDemo = await (await page.request.get("/api/v1/state")).json();
  expect(updatedDemo.events).toHaveLength(originalDemo.events.length + 1);
  expect(
    updatedDemo.events.find(
      (e: any) => e.description === "Демонстрационная мойка",
    ).amount_minor,
  ).toBe(123);
  expect(errors).toEqual([]);
});

test("360px mobile quick expense, edit, delete undo and no horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await demo(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.cache/screenshots/garage-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Расход Любая покупка для автомобиля" })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("1234.56");
  await page.getByLabel("Описание", { exact: true }).fill("Мобильная проверка");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Мобильная проверка", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Мобильная проверка", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("1500.15");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByText("Мобильная проверка", { exact: true }).first().click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(
    page.getByText("Мобильная проверка", { exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".toast")
    .getByRole("button", { name: "Отменить", exact: true })
    .click();
  await expect(
    page.getByText("Мобильная проверка", { exact: true }).first(),
  ).toBeVisible();
});

test("offline durable outbox survives reload and syncs exactly once", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Расход Любая покупка для автомобиля" })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("777.77");
  await page.getByLabel("Описание", { exact: true }).fill("Офлайн операция");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Офлайн операция", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Офлайн операция", { exact: true }).first(),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const rows = await page.evaluate(async () => {
    const response = await fetch("/api/v1/state");
    return (await response.json()).events.filter(
      (e: any) => e.description === "Офлайн операция",
    );
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].amount_minor).toBe(77777);
});

test("new vehicle, document upload and reminder workflow", async ({ page }) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Добавить автомобиль", exact: true })
    .click();
  await page
    .getByLabel("Название автомобиля", { exact: true })
    .fill("Тестовый автомобиль");
  await page.getByLabel("Пробег при покупке, км").fill("100000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовый автомобиль", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть Тестовый автомобиль" })
    .click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByLabel("Что нужно сделать").fill("Проверить тормоза");
  await page.getByLabel("На пробеге, км").fill("101000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Проверить тормоза", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Документы", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить документ", exact: true })
    .first()
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Тестовый PDF");
  await page.locator("input[type=file]").setInputFiles({
    name: "document.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"),
  });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовый PDF", exact: true }),
  ).toBeVisible();
});

test("offline create then edit keeps mutation order, including after reload", async ({
  page,
  context,
}) => {
  await demo(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Расход Любая покупка для автомобиля" })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("111.11");
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Последовательный офлайн");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByText("Последовательный офлайн", { exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("222.22");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Последовательный офлайн", { exact: true }).first(),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const rows = await page.evaluate(async () =>
    (await (await fetch("/api/v1/state")).json()).events.filter(
      (e: any) => e.description === "Последовательный офлайн",
    ),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].amount_minor).toBe(22222);
});

test("every primary screen fits 360px and light theme is usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await demo(page);
  for (const name of [
    "История",
    "Заправки",
    "Обслуживание",
    "Аналитика",
    "Документы",
    "Напоминания",
    "Настройки",
    "Мой гараж",
  ]) {
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Сменить тему" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "../.cache/screenshots/garage-light-mobile.png",
    fullPage: true,
  });
});

test("queued conflict is visible and server version is preserved explicitly", async ({
  page,
  context,
}) => {
  await demo(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const fixture = await page.evaluate(async () => {
    const session = await (await fetch("/api/v1/session")).json();
    const state = await (await fetch("/api/v1/state")).json();
    const data = {
      kind: "expense",
      vehicle_id: state.vehicles[0].id,
      occurred_at: new Date().toISOString().slice(0, 10),
      amount: "300",
      description: "Проверка конфликта",
    };
    const response = await fetch("/api/v1/mutate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrf,
      },
      body: JSON.stringify({
        operation_id: crypto.randomUUID(),
        id: crypto.randomUUID(),
        entity: "event",
        action: "create",
        data,
      }),
    });
    return { session, record: (await response.json()).record };
  });
  await page.reload();
  await expect(
    page.getByText("Проверка конфликта", { exact: true }).first(),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByText("Проверка конфликта", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const changed = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": fixture.session.csrf },
    data: {
      operation_id: crypto.randomUUID(),
      id: fixture.record.id,
      entity: "event",
      action: "update",
      expected_version: fixture.record.version,
      data: { ...fixture.record, amount: "500" },
    },
  });
  expect(changed.ok()).toBe(true);
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "Оставить серверную" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Оставить серверную" }).click();
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(
    state.events.find((e: any) => e.id === fixture.record.id).amount_minor,
  ).toBe(50000);
});

test("fuel derives total and maintenance items count only once", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .click();
  await page.getByRole("button", { name: /^Заправка/ }).click();
  await page.getByLabel("Литры", { exact: true }).fill("42.13");
  await page.getByLabel("Цена за литр, ₽", { exact: true }).fill("61.27");
  await page.getByLabel("Описание", { exact: true }).fill("Проверка топлива");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Добавить запись", exact: true })
    .click();
  await page.getByRole("button", { name: /^ТО \/ ремонт/ }).click();
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Проверка позиций ТО");
  await page
    .getByRole("button", { name: "Добавить позицию", exact: true })
    .click();
  await page
    .locator(".item-editor")
    .getByLabel("Название", { exact: true })
    .fill("Масло");
  await page.getByLabel("Артикул", { exact: true }).fill("TEST-123");
  await page.getByLabel("Кол-во", { exact: true }).fill("4");
  await page.getByLabel("Цена, ₽", { exact: true }).fill("1000.01");
  await page.getByLabel("Скидка, ₽", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = await (await page.request.get("/api/v1/state")).json();
  const fuel = state.events.filter(
    (e: any) => e.description === "Проверка топлива",
  );
  const service = state.events.filter(
    (e: any) => e.description === "Проверка позиций ТО",
  );
  expect(fuel).toHaveLength(1);
  expect(fuel[0].amount_minor).toBe(258131);
  expect(service).toHaveLength(1);
  expect(service[0].amount_minor).toBe(390004);
  expect(service[0].items[0].part_number).toBe("TEST-123");
});

test("ownership tools: confirmed tire history, budget and reviewed CSV repeat", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await demo(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.getByRole("tab", { name: "Шины", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Комплекты шин", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить комплект", exact: true })
    .click();
  await page.getByLabel("Марка шин", { exact: true }).fill("Nokian");
  await page.getByLabel("Модель шин", { exact: true }).fill("Hakka");
  await page.getByLabel("Размер", { exact: true }).fill("235/55 R19");
  await page
    .getByRole("button", { name: "Добавить установку", exact: true })
    .click();
  await page.getByLabel("Установлены", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Пробег установки", { exact: true }).fill("100000");
  await page.getByLabel("Сняты", { exact: true }).fill("2026-03-01");
  await page.getByLabel("Пробег снятия", { exact: true }).fill("105000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Nokian Hakka", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../.cache/screenshots/tires-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Бюджет", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Бюджет и будущие расходы",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Импорт", exact: true }).click();
  const content =
    "external_id,occurred_at,kind,amount,description\nweb-1,2026-01-01,expense,123.45,CSV browser test\nweb-2,2026-01-02,expense,-5,Invalid row\n";
  await page.locator("input[type=file]").setInputFiles({
    name: "history.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByText("Строка 2 · CSV browser test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Подтвердить импорт · 1", exact: true })
    .click();
  await expect(
    page.getByText(
      "История импортирована. Повторные операции защищены от дублирования.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "history.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByText("Уже импортирована / повтор в файле", { exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(
    state.events.filter((e: any) => e.description === "CSV browser test"),
  ).toHaveLength(1);
  expect(
    state.tire_sets.find((t: any) => t.brand === "Nokian").confirmed_km,
  ).toBe(5000);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("offline tire draft survives reload and synchronizes once", async ({
  page,
  context,
}) => {
  await demo(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  await page.getByRole("tab", { name: "Шины", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Добавить комплект", exact: true })
    .click();
  await page.getByLabel("Марка шин", { exact: true }).fill("Offline tires");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Offline tires", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Бюджет", exact: true }).click();
  await page
    .getByRole("button", { name: "Задать бюджет", exact: true })
    .click();
  await page.getByLabel("Сумма", { exact: true }).fill("100");
  await page
    .getByLabel("Категория (пусто — все расходы)", { exact: true })
    .fill("Offline category");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Offline category · RUB", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  await page.getByRole("tab", { name: "Шины", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Offline tires", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(
    state.budgets.filter((b: any) => b.category === "Offline category"),
  ).toHaveLength(1);
  expect(
    state.tire_sets.filter((t: any) => t.brand === "Offline tires"),
  ).toHaveLength(1);
});
