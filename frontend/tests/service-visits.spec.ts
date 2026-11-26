import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { closeDemoSession } from "./demo-session";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.125" } });
test.afterEach(async ({ page }) => closeDemoSession(page));

test("selected service concerns close on save and appear in the downloadable repair report", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Обслуживание", exact: true })
    .click();
  const panel = page.locator(".service-visits");
  const description = panel.getByLabel("Задача для СТО", { exact: true });
  for (const item of ["Стук слева", "Проверить кондиционер"]) {
    await description.fill(item);
    await panel.getByRole("button", { name: "Добавить задачу" }).click();
    await expect(panel.getByRole("checkbox", { name: item })).toBeVisible();
  }
  await panel.getByRole("checkbox", { name: "Стук слева" }).check();
  await panel
    .getByRole("button", { name: "Записать визит и закрыть задачи" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      "После сохранения будут закрыты выбранные задачи для СТО.",
    ),
  ).toBeVisible();
  await expect(panel.getByText("Стук слева", { exact: true })).toBeAttached();
  await dialog.locator("input[name=description]").fill("Заменили подшипник");
  await dialog.locator("input[name=amount]").fill("123.45");
  await dialog
    .getByLabel("Что проверить после визита")
    .fill("Послушать на трассе");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole("checkbox", { name: "Стук слева" })).toHaveCount(
    0,
  );
  await expect(
    panel.getByRole("checkbox", { name: "Проверить кондиционер" }),
  ).toBeVisible();
  await panel.getByText("Отчёт после ремонта", { exact: true }).click();
  await expect(panel.locator(".service-visit-report")).toContainText(
    "Стук слева",
  );
  await expect(panel.locator(".service-visit-report")).toContainText(
    "Заменили подшипник",
  );
  await expect(panel.locator(".service-visit-report")).toContainText(
    "Послушать на трассе",
  );
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Скачать отчёт" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mashina-service-visit.txt");
  const text = await readFile(await download.path(), "utf-8");
  expect(text).toContain("Заменили подшипник");
  expect(text).not.toContain("Проверить кондиционер");
});
