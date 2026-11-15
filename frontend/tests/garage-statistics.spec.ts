import { expect, test } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.72" } });

test("garage statistics and maintenance filters are usable in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  const card = page.locator(".vehicle-card").filter({ hasText: "Volvo XC60" });
  await expect(card.getByText("За всё время", { exact: true })).toBeVisible();
  await expect(card.getByText("Все расходы", { exact: true })).toBeVisible();
  await expect(card.getByText("Стоимость километра")).toBeVisible();
  await expect(card.getByText("Средний расход")).toBeVisible();
  await expect(card.locator(".vehicle-statistics strong").last()).toHaveText(
    /л \/ 100 км/,
  );

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
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Настройки", exact: true })
    .click();
  await page.getByRole("button", { name: "Выйти из гаража" }).click();
  await expect(
    page.getByRole("button", { name: "Посмотреть демогараж" }),
  ).toBeVisible();
});
