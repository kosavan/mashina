import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("legacy v1 IndexedDB queue survives the current client and syncs exactly once", async ({ page, context }) => {
  const setup = await (await page.request.get("/api/v1/setup")).json();
  const login = await page.request.post(setup.required ? "/api/v1/setup" : "/api/v1/login", {
    headers: { "X-Forwarded-For": "198.51.100.63" },
    data: { username: "browser-owner", password: "browser-test-password", bootstrap_token: "browser-test-bootstrap-only" },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const car = (await (await page.request.post("/api/v1/mutate", {
    headers: { "X-CSRF-Token": session.csrf },
    data: { operation_id: randomUUID(), id: randomUUID(), entity: "vehicle", action: "create", data: { name: "Upgrade queue car" } },
  })).json()).record;
  const state = await (await page.request.get("/api/v1/state")).json();
  const operation = {
    operation_id: randomUUID(), id: randomUUID(), entity: "event", action: "create",
    data: { vehicle_id: car.id, kind: "expense", occurred_at: "2026-01-02", amount: "12.34", description: "Preserved legacy draft" },
  };
  await page.goto("/");
  await expect(page.locator(".vehicle-grid")).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  // Representative persisted v1 envelope from earlier releases, not a new-client save.
  await page.evaluate(async ({ session, state, operation }) => {
    const pending = { ...operation.data, id: operation.id, version: 1, amount_minor: 1234, currency: "RUB", items: [], odometer: null, pending: true };
    state.events.push(pending);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("mashina-private-v1", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["cache", "outbox"], "readwrite");
        tx.objectStore("cache").put({ session, state }, "current");
        tx.objectStore("cache").put({ session, state }, session.id);
        tx.objectStore("outbox").put({ ...operation, owner: session.id, queued_at: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { session, state, operation });
  await page.reload();
  await expect(page.locator(".vehicle-grid")).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => {
    const current = await (await page.request.get("/api/v1/state")).json();
    return current.events.filter((entry: { id: string }) => entry.id === operation.id);
  }).toEqual([expect.objectContaining({ id: operation.id, amount_minor: 1234, description: "Preserved legacy draft" })]);
  const replay = await page.request.post("/api/v1/mutate", { headers: { "X-CSRF-Token": session.csrf }, data: operation });
  expect(replay.ok()).toBeTruthy();
  expect((await replay.json()).record.id).toBe(operation.id);
  const final = await (await page.request.get("/api/v1/state")).json();
  expect(final.events.filter((entry: { id: string }) => entry.id === operation.id)).toHaveLength(1);
});
