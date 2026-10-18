import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.184" } });
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/v1/session");
  if (response.ok()) {
    const session = await response.json();
    if (session.demo) await page.request.post("/api/v1/logout", { headers: { "X-CSRF-Token": session.csrf } });
  }
});

test("vehicle profile loads a compact private photo and preserves original downloads", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Язык / Language", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Explore the demo garage" }).click();
  await expect(page.getByRole("heading", { name: "My garage", exact: true })).toBeVisible();
  const session = await (await page.request.get("/api/v1/session")).json();
  const state = await (await page.request.get("/api/v1/state")).json();
  const car = state.vehicles[0];
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600; canvas.height = 1000;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(1600, 1000);
    let seed = 42;
    for (let i = 0; i < image.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        image.data[i + channel] = seed >>> 24;
      }
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const uploaded = await page.request.post("/api/v1/attachments", {
    headers: { "X-CSRF-Token": session.csrf },
    multipart: { vehicle_id: car.id, title: "Large synthetic cover", file: { name: "large.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") } },
  });
  expect(uploaded.ok()).toBeTruthy();
  const attachment = await uploaded.json();
  const changed = await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": session.csrf },
    data: { operation_id: randomUUID(), entity: "vehicle", action: "update", id: car.id, expected_version: car.version, data: { ...car, photo_id: attachment.id } },
  });
  expect(changed.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Open " + car.name, exact: true }).click();
  const image = page.locator(".vehicle-hero img");
  await expect(image).toHaveAttribute("src", `/api/v1/attachments/${attachment.id}?variant=card`);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const preview = await page.request.get(`/api/v1/attachments/${attachment.id}?variant=card`);
  const original = await page.request.get(`/api/v1/attachments/${attachment.id}`);
  const download = await page.request.get(`/api/v1/attachments/${attachment.id}?download=true`);
  expect(preview.headers()["content-type"]).toBe("image/webp");
  expect((await preview.body()).length).toBeLessThan((await original.body()).length * .6);
  expect(await download.body()).toEqual(await original.body());
});
