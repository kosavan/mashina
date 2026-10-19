import { test, expect } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.82" } });

test("360px local OCR review preserves draft, confirms fields and saves one fuel entry", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  const initial = await (await page.request.get("/api/v1/state")).json();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByRole("button", { name: /^Fill-up / }).click();
  await page.getByLabel("Description", { exact: true }).fill("Keep my draft");
  const oldOdometer = await page.getByLabel("Odometer, km", { exact: true }).inputValue();
  const file = { name: "invented-receipt.png", mimeType: "image/png", buffer: Buffer.from("UI interaction fixture; native engine has separate real image/PDF tests") };
  let calls = 0;
  // Controlled response tests review behavior only. Production never uses fixture OCR results.
  await page.route("**/api/v1/ocr", async route => {
    calls++;
    expect(route.request().postDataBuffer()?.toString()).toContain("receipt");
    await route.fulfill({ json: { engine: "tesseract-local", text: "TOTAL 1234.56\nODO 999999 km\n<script>alert(1)</script>", fields: { odometer: "999999" }, candidates: { amount: ["1234.56", "1234.58"] }, alternatives: ["TOTAL 1234.56", "TOTAL 1234.58"] } });
  });
  await page.getByRole("button", { name: "Read a photo or PDF" }).click();
  await page.getByLabel("Photo, screenshot or PDF", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Read locally", exact: true }).click();
  await expect(page.getByLabel("Recognized text", { exact: true })).toHaveValue(/TOTAL/);
  await page.getByRole("button", { name: "Cancel recognition", exact: true }).click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Keep my draft");
  await expect(page.getByLabel("Odometer, km", { exact: true })).toHaveValue(oldOdometer);
  expect((await (await page.request.get("/api/v1/state")).json()).events).toHaveLength(initial.events.length);
  await page.getByRole("button", { name: "Read a photo or PDF" }).click();
  await page.getByLabel("Photo, screenshot or PDF", { exact: true }).setInputFiles(file);
  await page.getByRole("button", { name: "Read locally", exact: true }).click();
  await expect(page.getByLabel("Reviewed field: Amount, ₽", { exact: true })).toHaveValue("");
  await page.getByRole("combobox", { name: "Recognition candidates: Amount, ₽", exact: true }).selectOption("1234.56");
  await expect(page.getByLabel("Apply Amount, ₽", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Reviewed field: Amount, ₽", { exact: true })).toHaveValue("1234.56");
  await page.getByLabel("Reviewed field: Amount, ₽", { exact: true }).fill("1200,01");
  await page.getByRole("checkbox", { name: "Apply Amount, ₽", exact: true }).check();
  await page.screenshot({ path: "../.cache/screenshots/ocr-review-mobile-en.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Apply selected fields", exact: true }).click();
  await expect(page.getByLabel("Amount, ₽", { exact: true })).toHaveValue("1200.01");
  await expect(page.getByLabel("Odometer, km", { exact: true })).toHaveValue(oldOdometer);
  await expect(page.getByLabel("Full tank", { exact: true })).not.toBeChecked();
  await page.getByLabel("Liters", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const final = await (await page.request.get("/api/v1/state")).json();
  const rows = final.events.filter((event: { description: string }) => event.description === "Keep my draft");
  expect(rows).toHaveLength(1);
  expect(rows[0].amount_minor).toBe(120001);
  expect(final.attachments).toHaveLength(initial.attachments.length);
  expect(calls).toBe(2);
});

test("Russian dashboard and arbitrary screenshot review has useful local failure and manual fallback", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page.getByRole("button", { name: "Добавить запись", exact: true }).click();
  await page.getByRole("button", { name: /^Обновить пробег / }).click();
  await page.getByRole("button", { name: "Распознать фото или PDF" }).click();
  await expect(page.getByLabel("Источник распознавания", { exact: true })).toHaveValue("odometer");
  await page.getByLabel("Источник распознавания", { exact: true }).selectOption("screenshot");
  await page.getByLabel("Фото, скриншот или PDF", { exact: true }).setInputFiles({ name: "invented.png", mimeType: "image/png", buffer: Buffer.from("bad") });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Распознать локально", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Ручной ввод работает офлайн");
  await context.setOffline(false);
  await page.route("**/api/v1/ocr", route => route.fulfill({ status: 422, json: { detail: "Текст не найден. Попробуйте более чёткий снимок." } }));
  await page.getByRole("button", { name: "Распознать локально", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Текст не найден");
  await page.getByRole("button", { name: "Распознать фото или PDF" }).click();
  await expect(page.getByLabel("Пробег, км", { exact: true })).toBeEditable();
});
