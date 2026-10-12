import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function profile(page: Page, locale = "en") {
  const setup = await (await page.request.get("/api/v1/setup")).json();
  const login = await page.request.post(setup.required ? "/api/v1/setup" : "/api/v1/login", {
    headers: { "X-Forwarded-For": "198.51.100.64" },
    data: { username: "browser-owner", password: "browser-test-password", bootstrap_token: "browser-test-bootstrap-only" },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  async function mutate(entity: string, data: object) {
    const response = await page.request.post("/api/v1/mutate", {
      headers: { "X-CSRF-Token": session.csrf },
      data: { operation_id: randomUUID(), id: randomUUID(), entity, action: "create", data },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).record;
  }
  await mutate("settings", { locale });
  const car = await mutate("vehicle", { name: "Body history car " + randomUUID().slice(0, 4), purchase_odometer: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: (locale === "ru" ? "Открыть " : "Open ") + car.name, exact: true }).click();
  await expect(page.locator(".body-section")).toBeVisible();
  return { car, mutate };
}

test("mobile body map: keyboard placement, multiple markers, repair evidence, undo and bilingual layout", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { car, mutate } = await profile(page);
  const service = await mutate("event", { vehicle_id: car.id, kind: "maintenance", occurred_at: "2026-01-01", description: "Body repair", amount: "1234.56" });
  await page.reload();
  await page.getByRole("button", { name: "Open " + car.name, exact: true }).click();
  const section = page.locator(".body-section");
  await section.getByRole("button", { name: "Front door", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Damage title", { exact: true }).fill("Door scratch");
  await dialog.getByLabel("Damage status", { exact: true }).selectOption("needs_repair");
  await dialog.getByText("Repair and additional details", { exact: true }).click();
  await dialog.getByLabel("Repair estimate", { exact: false }).fill("8500.25");
  await dialog.getByLabel("Link a service record", { exact: true }).selectOption(service.id);
  await dialog.getByLabel("Choose damage photos", { exact: true }).setInputFiles({
    name: "before.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8v0AAAAASUVORK5CYII=", "base64"),
  });
  await dialog.getByRole("button", { name: "Save damage", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await section.getByRole("button", { name: "Front door", exact: true }).click({ position: { x: 5, y: 5 } });
  await dialog.getByLabel("Damage title", { exact: true }).fill("Second scratch");
  await dialog.getByRole("button", { name: "Save damage", exact: true }).click();
  await expect(section.locator(".body-marker")).toHaveCount(2);
  await section.locator(".body-issue").filter({ hasText: "Door scratch" }).click();
  await expect(dialog.locator(".body-photo-grid img")).toHaveCount(1);
  await expect(dialog.getByText("Excluded from actual expenses", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Damage status", { exact: true }).selectOption("repaired");
  await dialog.getByLabel("Photo stage", { exact: true }).selectOption("after");
  await dialog.getByLabel("Choose damage photos", { exact: true }).setInputFiles({
    name: "after.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8v0AAAAASUVORK5CYII=", "base64"),
  });
  await dialog.getByRole("button", { name: "Save damage", exact: true }).click();
  await expect(section.locator(".body-issue")).toHaveCount(1);
  await section.getByLabel("Show damage", { exact: true }).selectOption("repaired");
  await section.locator(".body-issue").click();
  await expect(dialog.locator(".body-status-history li")).toHaveCount(2);
  await expect(dialog.locator(".body-photo-grid img")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(section.locator(".body-issue")).toHaveCount(1);
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(state.events.filter((e: { vehicle_id: string }) => e.vehicle_id === car.id)).toHaveLength(1);
  expect(state.vehicles.find((v: { id: string }) => v.id === car.id).current_odometer).toBe(1000);
  expect(state.body_damages.find((r: { title: string }) => r.title === "Door scratch").estimate_minor).toBe(850025);
  const damages = state.body_damages.filter((r: {vehicle_id: string}) => r.vehicle_id === car.id);
  expect(damages[0].x === damages[1].x && damages[0].y === damages[1].y).toBeFalsy();
  expect(await section.innerText()).not.toMatch(/[а-яё]/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await section.screenshot({ path: "../.cache/screenshots/body-map-mobile-en.png" });
  await section.getByRole("button", { name: "Mark damage", exact: true }).click();
  await dialog.getByLabel("Damage title", { exact: true }).fill("Unsaved");
  page.once("dialog", prompt => prompt.dismiss());
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeVisible();
  page.once("dialog", prompt => prompt.accept());
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("body markers survive offline create, edit and reload and synchronize once", async ({ page, context }) => {
  const { car } = await profile(page, "ru");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  // A supported pre-feature cache has no body_damages collection.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("mashina-private-v1", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("cache", "readwrite");
        const cursor = tx.objectStore("cache").openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          if (row.value?.state) {
            delete row.value.state.body_damages;
            row.update(row.value);
          }
          row.continue();
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Открыть " + car.name, exact: true }).click();
  const section = page.locator(".body-section");
  await section.getByRole("button", { name: "Отметить повреждение", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название повреждения", { exact: true }).fill("Offline scratch");
  await expect(dialog.getByLabel("Выбрать фото повреждения", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Сохранить повреждение", exact: true }).click();
  await section.locator(".body-issue").click();
  await dialog.getByRole("button", { name: "Редактировать", exact: true }).click();
  await dialog.getByLabel("Статус повреждения", { exact: true }).selectOption("planned");
  await dialog.getByRole("button", { name: "Сохранить повреждение", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Открыть " + car.name, exact: true }).click();
  await expect(section.locator(".body-issue")).toContainText("Offline scratch");
  await context.setOffline(false);
  await expect.poll(async () => {
    const state = await (await page.request.get("/api/v1/state")).json();
    return state.body_damages.filter((r: {vehicle_id: string}) => r.vehicle_id === car.id);
  }).toEqual([expect.objectContaining({ title: "Offline scratch", status: "planned", version: 2 })]);
  await page.reload();
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(state.body_damages.filter((r: {vehicle_id: string}) => r.vehicle_id === car.id)).toHaveLength(1);
});

test("isolated demo body views support keyboard selection, Russian and light theme", async ({ page }) => {

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Язык / Language").selectOption("ru");
  const demo = await page.request.post("/api/v1/demo", { headers: { "X-Forwarded-For": "198.51.100.65" } });
  expect(demo.ok()).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть Volvo XC60", exact: true }).click();
  const section = page.locator(".body-section");
  await expect(section.locator(".body-issue")).toHaveCount(2);
  for (const [view, panel] of [["Спереди", "Передний бампер"], ["Сзади", "Крышка багажника"], ["Слева", "Передняя дверь"], ["Справа", "Передняя дверь"], ["Сверху", "Крыша"]]) {
    await section.getByRole("button", { name: view, exact: true }).click();
    await section.locator(".body-canvas").screenshot({ path: `../.cache/screenshots/body-view-${view}.png` });
    await section.getByRole("button", { name: panel, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Новое повреждение" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  }
  await section.getByLabel("Показать повреждения", { exact: true }).selectOption("all");
  await expect(section.locator(".body-issue")).toHaveCount(3);
  await section.getByRole("button", { name: "Слева", exact: true }).click();
  await page.screenshot({ path: "../.cache/screenshots/body-profile-desktop-ru.png", fullPage: true });
  await page.evaluate(() => { localStorage.setItem("mashina-theme", "light"); });
  await page.reload();
  await page.getByRole("button", { name: "Открыть Volvo XC60", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  for (const view of ["Спереди", "Сзади", "Слева", "Справа", "Сверху"]) {
    await section.getByRole("button", { name: view, exact: true }).click();
    await section.locator(".body-canvas").screenshot({ path: `../.cache/screenshots/body-view-light-${view}.png` });
  }
  await section.getByRole("button", { name: "Слева", exact: true }).click();
  await section.screenshot({ path: "../.cache/screenshots/body-map-light-ru.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
