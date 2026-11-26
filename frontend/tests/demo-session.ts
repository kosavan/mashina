import type { Page } from "@playwright/test";

export async function closeDemoSession(page: Page) {
  await page.context().setOffline(false);
  const response = await page.request.get("/api/v1/session");
  if (!response.ok()) return;
  const session = await response.json();
  if (session.demo) {
    await page.request.post("/api/v1/logout", {
      headers: { "X-CSRF-Token": session.csrf },
    });
  }
}
