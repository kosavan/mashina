import { expect, test } from "@playwright/test";

import { closeDemoSession } from "./demo-session";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.91" } });
test.afterEach(async ({ page }) => closeDemoSession(page));

test("renewal reminder follows the next record and exports the current calendar date", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть демогараж" }).click();
  const section = page.locator(".sidebar").getByRole("button", {
    name: "Регистрация и страховка",
  });
  await section.click();
  const dialog = page.getByRole("dialog");
  const date = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  async function addRenewal(dateOfPayment: string, expiry: string) {
    await page.getByRole("button", { name: "Добавить страховку" }).click();
    await dialog.locator("input[name=occurred_at]").fill(dateOfPayment);
    await dialog.getByLabel("Действует до").fill(expiry);
    await dialog.locator("input[name=amount]").fill("42");
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }

  await addRenewal(date(-2) + "T12:00", date(25));
  await page.getByRole("button", { name: "Напомнить о продлении" }).click();
  await dialog.locator("select[name=warning_days]").selectOption("14");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("За 14 дн. до продления")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await section.click();
  await context.setOffline(true);
  await addRenewal(date(-1) + "T12:00", date(100));
  await page.reload();
  await section.click();
  await page.getByRole("button", { name: "Настроить напоминание" }).click();
  await expect(dialog.locator("input[name=due_date]")).toHaveValue(date(100));
  await expect(dialog.locator("select[name=warning_days]")).toHaveValue("14");
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await context.setOffline(false);
  await expect(page.getByText("Всё сохранено", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/v1/state")).json();
  expect(
    state.reminders.filter(
      (row: { renewal_schedule?: unknown }) => row.renewal_schedule,
    ),
  ).toMatchObject([
    {
      due_date: date(100),
      renewal_schedule: { type: "insurance", lead_days: 14 },
    },
  ]);
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Добавить в календарь" }).click();
  const file = await pendingDownload;
  expect(file.suggestedFilename()).toBe("mashina-renewal.ics");
});
