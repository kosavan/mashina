import { test, expect, request as apiRequest } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("scoped key: 360px copy once, manual fallback, offline and revoke", async ({
  page,
  context,
}) => {
  const api = await apiRequest.newContext({ baseURL: "http://127.0.0.1:8000" });
  const setup = await (await api.get("/api/v1/setup")).json();
  const login = await api.post(
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
  const csrf = (await login.json()).csrf;
  await context.addCookies((await api.storageState()).cookies);
  const name = "Интеграция " + randomUUID().slice(0, 8);
  const car = await api.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": csrf },
    data: {
      entity: "vehicle",
      action: "create",
      id: randomUUID(),
      operation_id: randomUUID(),
      data: { name },
    },
  });
  expect(car.ok()).toBeTruthy();
  const carId = (await car.json()).record.id;
  const olderLabel = name + " прежний клиент";
  const olderKey = await api.post("/api/v1/machine/credentials", {
    headers: { "X-CSRF-Token": csrf },
    data: { label: olderLabel, vehicle_ids: [carId] },
  });
  expect(olderKey.ok()).toBeTruthy();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .evaluate((el: HTMLButtonElement) => el.click());
  await page
    .getByRole("button", { name: "API и интеграции", exact: true })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "Новое подключение" }),
  ).toBeVisible();
  await sheet.getByLabel("Название подключения", { exact: true }).fill(name);
  page.once("dialog", (dialog) => dialog.dismiss());
  await sheet.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    sheet.getByLabel("Название подключения", { exact: true }),
  ).toHaveValue(name);
  await sheet.getByRole("checkbox", { name, exact: true }).check();
  await sheet
    .getByLabel("Доверяю этому клиенту историю выбранных автомобилей", {
      exact: false,
    })
    .check();
  await sheet
    .getByRole("button", { name: "Создать ключ", exact: true })
    .click();
  const input = sheet.getByLabel("Ваш новый ключ", { exact: true });
  await expect(input).toBeVisible();
  const secret = await input.inputValue();
  const keyCard = sheet
    .locator(".machine-key")
    .filter({
      has: page.getByRole("button", { name: `Отозвать ${name}`, exact: true }),
    });
  await expect(keyCard.locator("span").filter({ hasText: name })).toContainText(
    name,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await sheet
    .getByRole("button", { name: `Отозвать ${olderLabel}`, exact: true })
    .click();
  await expect(input).toHaveValue(secret);
  await input.scrollIntoViewIfNeeded();
  expect(secret.startsWith("msh_")).toBeTruthy();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("clipboard unavailable");
        },
      },
    }),
  );
  await sheet
    .getByRole("button", { name: "Скопировать ключ", exact: true })
    .click();
  await expect(
    sheet.getByText("Выделите ключ в поле", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await sheet.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(input).toBeVisible();
  await page.screenshot({
    path: "../.cache/screenshots/machine-access-dark.png",
  });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "light"),
  );
  await page.screenshot({
    path: "../.cache/screenshots/machine-access-light.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await sheet
    .getByRole("button", { name: "Скопировать ключ", exact: true })
    .click();
  await expect(
    sheet.getByRole("button", { name: "Ключ скопирован", exact: true }),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page
    .getByRole("button", { name: "API и интеграции", exact: true })
    .click();
  await expect(sheet.getByLabel("Ваш новый ключ", { exact: true })).toHaveCount(
    0,
  );
  const revoke = sheet.getByRole("button", {
    name: `Отозвать ${name}`,
    exact: true,
  });
  await expect(revoke).toBeEnabled();
  await context.setOffline(true);
  await expect(revoke).toBeDisabled();
  await expect(
    sheet.getByText("Управление ключами доступно при подключении", {
      exact: false,
    }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.route("**/api/v1/machine/credentials/*", (route) => route.abort());
  page.once("dialog", (dialog) => dialog.accept());
  await revoke.click();
  await expect(sheet.getByRole("alert")).toContainText(
    "Не удалось связаться с сервером",
  );
  await page.unroute("**/api/v1/machine/credentials/*");
  page.once("dialog", (dialog) => dialog.accept());
  await revoke.click();
  await expect(revoke).toBeDisabled();
  const response = await api.get("/api/machine/v1/vehicles", {
    headers: { Authorization: "Bearer " + secret },
  });
  expect(response.status()).toBe(401);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    secret,
  );
  const cached = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mashina-private-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction("cache")
        .objectStore("cache")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return JSON.stringify(result);
  });
  expect(cached).not.toContain(secret);
  await api.dispose();
});
