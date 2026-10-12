import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

test("device notifications require consent and disconnect locally without any provider request", async ({ page, context, request }) => {
  const credentials = { username: "browser-owner", password: "browser-test-password", bootstrap_token: "browser-test-bootstrap-only" };
  const setup = await request.get("/api/v1/setup");
  const login = await request.post((await setup.json()).required ? "/api/v1/setup" : "/api/v1/login", { data: credentials });
  expect(login.ok()).toBeTruthy();
  const owner = await login.json();
  execFileSync(resolve("../.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), ["-X", "utf8", "-m", "backend.cli", "notification-keys", "--data", ".cache/browser-test-data"], { cwd: resolve("..") });
  const endpoint = "https://fcm.googleapis.com/fcm/send/browser-test-" + randomUUID();
  await page.addInitScript(({ endpoint }) => {
    let subscription: any = null;
    let permission: NotificationPermission = "default";
    (window as any).permissionRequests = 0;
    Object.defineProperty(Notification, "permission", { get: () => permission });
    Notification.requestPermission = async () => { (window as any).permissionRequests++; permission = "granted"; return permission; };
    PushManager.prototype.getSubscription = async () => subscription;
    PushManager.prototype.subscribe = async (options) => {
      const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
      const point = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
      const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      subscription = { endpoint, options, toJSON: () => ({ endpoint, keys: { p256dh: encode(point), auth: encode(new Uint8Array(16).fill(42)) } }), unsubscribe: async () => { subscription = null; return true; } };
      return subscription;
    };
  }, { endpoint });
  await context.addCookies((await request.storageState()).cookies);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Мой гараж", exact: true })).toBeVisible();
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Уведомления", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Подключить устройство" })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).permissionRequests)).toBe(0);
  await sheet.getByRole("checkbox").check();
  await sheet.getByRole("button", { name: "Подключить устройство" }).click();
  await expect(sheet.getByText("Это устройство подключено")).toBeVisible();
  expect(await page.evaluate(() => (window as any).permissionRequests)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await sheet.evaluate(element => element.scrollTop = 0);
  await page.screenshot({ path: "../.cache/screenshots/notifications-mobile.png" });
  const device = await (await request.post("/api/v1/notifications/push/current", { headers: { "X-CSRF-Token": owner.csrf }, data: { endpoint } })).json();
  await sheet.getByRole("button", { name: "Отключить", exact: true }).last().click();
  await expect(sheet.getByText("Это устройство подключено")).toHaveCount(0);
  expect((await (await request.get("/api/v1/notifications")).json()).push.some((item: any) => item.id === device.id)).toBe(false);
});

test("demonstration notification settings remain isolated", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByRole("button", { name: "Уведомления", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/Демогараж изолирован/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Подключить устройство" })).toHaveCount(0);
});

test("missing setup and unsupported browsers explain notification availability", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "PushManager", { value: undefined }));
  let configured = false;
  await page.route("**/api/v1/notifications", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const status = await response.json();
    await route.fulfill({ response, json: { ...status, push_configured: configured } });
  });
  await page.goto("/");
  await page.getByLabel("Имя пользователя", { exact: true }).fill("browser-owner");
  await page.getByLabel("Пароль", { exact: true }).fill("browser-test-password");
  await page.getByRole("button", { name: "Войти в гараж", exact: true }).click();
  await page.locator(".sidebar").getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByRole("button", { name: "Уведомления", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(/Остальное приложение работает без уведомлений/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Подключить устройство" })).toHaveCount(0);
  configured = true;
  await sheet.getByRole("button", { name: "Обновить", exact: true }).click();
  await expect(sheet.getByText(/Этот браузер не предоставляет Web Push/)).toBeVisible();
  await expect(sheet.getByText(/добавьте MASHINA на экран/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Подключить устройство" })).toHaveCount(0);
});
