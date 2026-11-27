import { expect, test } from "@playwright/test";
import { closeDemoSession } from "./demo-session";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.167" } });
test.afterEach(async ({ page }) => closeDemoSession(page));

test("mobile entry, drawer keyboard and profile history work at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Больше, чем просто гараж.",
  );
  const login = page.getByRole("textbox", { name: "Имя пользователя" });
  await expect(login).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  const garage = page.getByRole("heading", { name: "Мой гараж", exact: true });
  await expect(garage).toBeVisible();

  const more = page.getByRole("button", { name: "Ещё", exact: true });
  const drawer = page.getByRole("dialog", { name: "Главная навигация" });
  await more.click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Мой гараж", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  expect(
    await drawer.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await expect(drawer).toBeVisible();
  await page.goBack();
  await expect(drawer).toHaveCount(0);
  await expect(garage).toBeVisible();

  const openCar = page.getByRole("button", {
    name: "Открыть Volvo XC60",
    exact: true,
  });
  await openCar.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await openCar.click();
  await expect(
    page.getByRole("heading", { name: "Volvo XC60", exact: true }),
  ).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(garage).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});
