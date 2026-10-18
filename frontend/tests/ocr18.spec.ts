import { test, expect } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.182" } });
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/v1/session");
  if (response.ok()) {
    const session = await response.json();
    if (session.demo) await page.request.post("/api/v1/logout", { headers: { "X-CSRF-Token": session.csrf } });
  }
});

test("OCR crop, rotation and PDF pages are explicit; reviewed line items save one exact expense", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByRole("button", { name: /^Maintenance \/ repair / }).click();
  await page.getByRole("button", { name: "Read a photo or PDF", exact: true }).click();
  await page.getByLabel("Photo, screenshot or PDF", { exact: true }).setInputFiles({ name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
  await page.getByLabel("PDF pages separated by commas (up to three)", { exact: true }).fill("1,2");
  await page.getByText("Crop and rotate", { exact: true }).click();
  await page.getByLabel("Clockwise rotation", { exact: true }).selectOption("90");
  await page.getByLabel("Crop after rotation", { exact: true }).check();
  await page.getByLabel("Width, %", { exact: true }).fill("80");
  let submitted = "";
  await page.route("**/api/v1/ocr", async route => {
    submitted = route.request().postData() || "";
    await route.fulfill({ json: { engine: "tesseract-local", text: "Name | SKU | Qty | Price\nOil | ABC-12 | 2 | 123.45", fields: { amount: "246.90" }, items: [{ name: "Oil", part_number: "ABC-12", quantity: "2", unit_price: "123.45", discount: "0" }] } });
  });
  await page.getByRole("button", { name: "Read locally", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review invoice line items", exact: true })).toBeVisible();
  expect(submitted).toContain("1,2");
  expect(submitted).toContain("90");
  expect(submitted).toContain("[0,0,0.8,1]");
  await expect(page.getByLabel("Apply line item 1", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Apply Amount, ₽", { exact: true })).not.toBeChecked();
  await page.getByLabel("Apply line item 1", { exact: true }).check();
  await page.getByRole("button", { name: "Apply selected fields", exact: true }).click();
  await expect(page.locator('.items-list input[value="ABC-12"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = await (await page.request.get("/api/v1/state")).json();
  const events = state.events.filter((e: { items?: { part_number: string }[] }) => e.items?.some(i => i.part_number === "ABC-12"));
  expect(events).toHaveLength(1);
  expect(events[0].amount_minor).toBe(24690);
});
