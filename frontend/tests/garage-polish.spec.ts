import { expect, test } from "@playwright/test";
import { closeDemoSession } from "./demo-session";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.197" } });
test.afterEach(async ({ page }) => closeDemoSession(page));

test("compact garage links to vehicle sections and analytics keeps advanced filters available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await expect(
    page.getByRole("heading", { name: "Мой гараж", exact: true }),
  ).toBeVisible();
  const car = page.locator(".vehicle-card").first();
  await expect(car.getByRole("heading").first()).toBeInViewport();
  await expect(car.locator(".vehicle-next")).toBeInViewport();
  await car.getByRole("button", { name: /^Открыть/ }).click();
  await expect(page.locator(".vehicle-profile h1")).toBeInViewport();

  const sections = page.getByRole("navigation", { name: "Разделы автомобиля" });
  const supplies = page.locator("#vehicle-supplies");
  await expect(supplies).toBeAttached();
  await sections.getByRole("button", { name: "Расходники и запас" }).click();
  await expect(supplies).toBeFocused();
  await expect(supplies.getByRole("heading", { name: "Расходники и запас", exact: true })).toBeInViewport();

  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Аналитика" })
    .click();
  await expect(page.getByRole("heading", { name: "Аналитика" })).toBeVisible();
  const currency = page.getByLabel("Валюта аналитики");
  const advanced = page.locator(".analytics-more summary");
  await expect(currency).toBeHidden();
  await advanced.focus();
  await page.keyboard.press("Enter");
  await expect(currency).toBeVisible();
  await currency.selectOption("EUR");
  await expect(advanced).toContainText("EUR");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === innerWidth,
    ),
  ).toBe(true);
});
