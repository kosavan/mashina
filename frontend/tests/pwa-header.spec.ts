import { test, expect } from "@playwright/test";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.183" } });
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/v1/session");
  if (response.ok()) {
    const session = await response.json();
    if (session.demo) await page.request.post("/api/v1/logout", { headers: { "X-CSRF-Token": session.csrf } });
  }
});

for (const landscape of [false, true]) {
  test(`installed PWA header respects safe areas in ${landscape ? "landscape" : "portrait"}`, async ({ page }) => {
    await page.setViewportSize(landscape ? { width: 956, height: 440 } : { width: 440, height: 956 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
      localStorage.setItem("mashina-locale", "en");
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore the demo garage" }).click();
    await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-standalone", "true");
    const top = landscape ? 0 : 62, side = landscape ? 62 : 0;
    await page.evaluate(({ top, side }) => {
      const style = document.documentElement.style;
      style.setProperty("--safe-top", `${top}px`);
      style.setProperty("--safe-left", `${side}px`);
      style.setProperty("--safe-right", `${side}px`);
    }, { top, side });
    const menu = page.getByRole("button", { name: "Open menu", exact: true });
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(top);
    expect(bounds!.x).toBeGreaterThanOrEqual(side);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".breadcrumb strong")).toHaveText("My garage");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await menu.click();
    await expect.poll(async () => (await page.locator(".sidebar nav").boundingBox())!.x).toBeGreaterThanOrEqual(side);
    const close = await page.locator(".mobile-menu-close").boundingBox();
    expect(close!.y).toBeGreaterThanOrEqual(top);
    await page.locator(".sidebar").getByRole("button", { name: "History", exact: true }).click();
    await expect(page.locator(".breadcrumb strong")).toHaveText("History");
    await expect(page.locator(".page-heading")).toBeVisible();
    await page.screenshot({ path: `../.cache/screenshots/pwa-header-${landscape ? "landscape" : "portrait"}-${test.info().project.name}.png`, animations: "disabled" });
  });
}
