import { test, expect } from "@playwright/test";

// A distinct simulated client keeps this suite separate from the demo-abuse
// bucket exercised by other files. Production limits remain unchanged.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.43" } });

for (const width of [1440, 390]) {
  test(`fuel report preserves context at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await page.screenshot({ path: `../.cache/screenshots/auth-${width}.png` });
    await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
    await expect(
      page.getByRole("heading", { name: "Мой гараж", exact: true }),
    ).toBeVisible();
    if (width < 800)
      await page.getByRole("button", { name: "Открыть меню" }).click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Заправки", exact: true })
      .click();
    await page.getByRole("button", { name: "Графики и расход" }).click();
    await expect(
      page.getByRole("heading", { name: "Аналитика", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Тип расходов", { exact: true })).toHaveValue(
      "fuel",
    );
    await expect(page.getByLabel("Автомобиль аналитики")).not.toHaveValue("");
    await expect(page.locator(".recharts-surface").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("dedicated tires: offline measurements sync once and remain editable", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Шины", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Комплекты шин" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Добавить комплект", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Марка шин", { exact: true })
    .fill("Measured demo tires");
  await page.getByLabel("DOT самой старой шины").fill("3421");
  await page.getByLabel("Ваш порог замены, мм").fill("4");
  await page
    .getByRole("button", { name: "Добавить замер", exact: true })
    .click();
  await page.getByLabel("Минимум по комплекту, мм").fill("3.9");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const pending = page
    .locator(".tire-card")
    .filter({ hasText: "Measured demo tires" });
  await expect(pending.getByText("3,9 мм", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Шины", exact: true })
    .click();
  await expect(pending.getByText("3,9 мм", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  const tires = state.tire_sets.filter(
    (t: any) => t.brand === "Measured demo tires",
  );
  expect(tires).toHaveLength(1);
  expect(tires[0].tread_measurements[0].depth_tenths).toBe(39);
  const card = page
    .locator(".tire-card")
    .filter({ hasText: "Measured demo tires" });
  await expect(card.getByText(/Достигнут ваш порог/)).toBeVisible();
  await card.getByRole("button", { name: "История и параметры" }).click();
  await expect(page.getByLabel("Минимум по комплекту, мм")).toHaveValue("3.9");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.cache/screenshots/tires-mobile-form.png",
    fullPage: true,
  });
});

test("service location stays private until map is explicitly loaded", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/v1/session")).json();
  const state = await (await page.request.get("/api/v1/state")).json();
  const saved = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": session.csrf },
    data: {
      operation_id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      entity: "event",
      action: "create",
      data: {
        vehicle_id: state.vehicles[0].id,
        kind: "maintenance",
        occurred_at: "2026-01-01",
        amount: "100",
        description: "Private invented service",
        vendor: "Тестовый сервис",
        service_address: "Вымышленный адрес, 1",
        service_latitude: "55.75",
        service_longitude: "37.61",
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("openstreetmap.org")) requests.push(r.url());
  });
  await page.route("https://www.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Map provider fixture</p>",
    }),
  );
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "История", exact: true })
    .click();
  await page.getByLabel("Поиск по истории").fill("Private invented service");
  await page.getByText("Private invented service", { exact: true }).click();
  await expect(
    page.getByText("Вымышленный адрес, 1", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await page
    .getByRole("button", { name: "Загрузить карту · OpenStreetMap" })
    .click();
  await expect(
    page.locator("iframe[title='Место обслуживания на OpenStreetMap']"),
  ).toBeVisible();
  await expect.poll(() => requests.length).toBe(1);
});
