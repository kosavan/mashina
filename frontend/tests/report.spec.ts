import { test, expect } from "@playwright/test";

test("mobile sale report keeps disclosure explicit and downloads a real PDF", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  await page.getByRole("heading", { name: "Volvo XC60", exact: true }).click();
  await page.getByRole("button", { name: "Отчёт для продажи" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("checkbox")).toHaveCount(4);
  for (const checkbox of await sheet.getByRole("checkbox").all()) {
    await expect(checkbox).not.toBeChecked();
  }
  await sheet.getByRole("checkbox", { name: /^Обложка автомобиля/ }).check();
  await sheet.getByRole("checkbox", { name: /^Финансовые суммы/ }).check();
  await sheet.evaluate(element => element.scrollTop = 0);
  await page.screenshot({ path: "../.cache/screenshots/report-options-mobile.png", fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const downloading = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Скачать PDF" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("mashina-sale-report.pdf");
  await download.saveAs("../.cache/pdfqa/demo-report.pdf");
  await expect(sheet.getByRole("button", { name: "Скачать PDF" })).toBeEnabled();
  await page.route("**/sale-report", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Сервер временно недоступен" }) }));
  await sheet.getByRole("button", { name: "Скачать PDF" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Сервер временно недоступен");
  await page.unroute("**/sale-report");
  await page.context().setOffline(true);
  await sheet.getByRole("button", { name: "Скачать PDF" }).click();
  await expect(sheet.getByRole("alert")).toContainText("подключиться к вашему серверу");
});
