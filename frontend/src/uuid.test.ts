import { afterEach, expect, it, vi } from "vitest";
import { createUuid } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

it("uses the browser's UUID generator when available", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const randomUUID = vi.fn(() => id);
  vi.stubGlobal("crypto", { randomUUID });
  expect(createUuid()).toBe(id);
  expect(randomUUID).toHaveBeenCalledOnce();
});

it("generates UUIDv4 identifiers without randomUUID", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  });
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const first = createUuid();
  const second = createUuid();
  expect(first).toMatch(uuidV4);
  expect(second).toMatch(uuidV4);
  expect(second).not.toBe(first);
});
