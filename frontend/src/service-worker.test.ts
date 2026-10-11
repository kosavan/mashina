import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

describe("private push behavior", () => {
  it("ignores private remote payload and external click targets", async () => {
    const handlers: Record<string, (event: any) => void> = {};
    const shown: any[] = [];
    const opened: string[] = [];
    const self = {
      location: { origin: "https://garage.example.com" },
      addEventListener: (type: string, handler: (event: any) => void) => {
        handlers[type] = handler;
      },
      registration: {
        showNotification: async (...args: any[]) => {
          shown.push(args);
        },
      },
      clients: {
        matchAll: async () => [],
        openWindow: async (url: string) => {
          opened.push(url);
        },
      },
    };
    runInNewContext(
      readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
      { self, URL },
    );
    let pending: Promise<unknown> = Promise.resolve();
    handlers.push({
      data: {
        json: () => ({
          title: "PRIVATE VIN",
          body: "SECRET",
          url: "https://evil.example.com",
        }),
      },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    expect(JSON.stringify(shown)).not.toContain("SECRET");
    expect(shown[0][0]).toBe("MASHINA");
    handlers.notificationclick({
      notification: { close() {}, data: { url: "https://evil.example.com" } },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    expect(opened).toEqual(["https://garage.example.com/"]);
  });
});
