import { expect, test } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.72" } });
test.afterEach(async ({ page, context }) => {
  await context.setOffline(false);
  const response = await page.request.get("/api/v1/session");
  if (response.ok()) {
    const session = await response.json();
    if (session.demo)
      await page.request.post("/api/v1/logout", {
        headers: { "X-CSRF-Token": session.csrf },
      });
  }
});

test("garage statistics and maintenance filters are usable in both themes", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  const card = page.locator(".vehicle-card").filter({ hasText: "Volvo XC60" });
  await expect(card.getByText("За всё время", { exact: true })).toBeVisible();
  await expect(card.getByText("Все расходы", { exact: true })).toBeVisible();
  await expect(card.getByText("Стоимость километра")).toBeVisible();
  await expect(card.getByText("Средний расход")).toBeVisible();
  const consumption = card.locator(".vehicle-statistics strong").last();
  await expect(consumption).toHaveText(/л \/ 100 км/);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(consumption).toHaveText(/л \/ 100 км/);
  await context.setOffline(false);

  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  const vehicle = page.getByRole("combobox", {
    name: "Автомобиль",
    exact: true,
  });
  const volvo = vehicle.locator("option").filter({ hasText: "Volvo XC60" });
  await expect(volvo).toHaveCSS("color", "rgb(240, 242, 235)");
  await expect(volvo).toHaveCSS("background-color", "rgb(24, 27, 25)");
  await page.getByRole("button", { name: "Сменить тему" }).click();
  await expect(volvo).toHaveCSS("color", "rgb(36, 42, 32)");
  await expect(volvo).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await vehicle.selectOption({ label: "Volvo XC60" });
  await expect(vehicle.locator("option:checked")).toHaveText("Volvo XC60");
});
