import { expect, test, type Page } from "@playwright/test";
import { closeDemoSession } from "./demo-session";

async function openMaintenance(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Посмотреть демогараж", exact: true })
    .click();
  await page.getByRole("heading", { name: "Мой гараж", exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "Мобильная навигация" })
    .getByRole("button", { name: "Ещё", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Главная навигация" })
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
}

test.describe("mobile maintenance navigation", () => {
  test.use({
    viewport: { width: 360, height: 800 },
    extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.205" },
  });
  test.afterEach(async ({ page }) => closeDemoSession(page));

  test("renders the page heading first and moves focus between related panels", async ({
    page,
  }) => {
    await openMaintenance(page);
    const heading = page.getByRole("heading", {
      name: "Обслуживание",
      level: 1,
      exact: true,
    });
    const tabs = page.getByRole("tablist", {
      name: "Инструменты обслуживания",
    });
    await expect(heading).toBeVisible();
    await expect(tabs).toBeVisible();
    expect((await heading.boundingBox())!.y).toBeLessThan(
      (await tabs.boundingBox())!.y,
    );

    const work = tabs.getByRole("tab", { name: "Работы", exact: true });
    await work.focus();
    await page.keyboard.press("ArrowRight");
    const tires = tabs.getByRole("tab", { name: "Шины", exact: true });
    await expect(tires).toBeFocused();
    await expect(tires).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel", { name: "Шины" });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("id", (await tires.getAttribute("aria-controls"))!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(360);
  });

  test("offers the localized CSV and receipt pickers before reference material", async ({
    page,
  }) => {
    await openMaintenance(page);
    await page.getByRole("tab", { name: "Импорт", exact: true }).click();
    const upload = page.getByLabel("Выбрать CSV для проверки", { exact: true });
    const format = page.locator(".csv-format");
    await expect(upload).toBeEnabled();
    await expect(format).not.toHaveAttribute("open", "");
    expect((await upload.boundingBox())!.y).toBeLessThan(
      (await format.boundingBox())!.y,
    );
    await format.getByText("Документированный формат").click();
    await expect(format).toHaveAttribute("open", "");
    await expect(format.locator("code")).toBeVisible();

    await page.getByRole("tab", { name: "Чеки", exact: true }).click();
    const receipt = page.getByLabel("Добавить фото чека", { exact: true });
    const fileChooser = page.waitForEvent("filechooser");
    await receipt.focus();
    await page.keyboard.press("Enter");
    expect(await fileChooser).toBeTruthy();
    await expect(receipt).toHaveCSS("opacity", "0");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
});
