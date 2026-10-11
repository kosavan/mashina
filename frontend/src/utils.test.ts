import { describe, it, expect } from "vitest";
import { exactMinor, currentKm, sumEvents } from "./utils";
import type { Entry, Vehicle } from "./types";
describe("exact presentation and historical readings", () => {
  it("adds cents exactly", () =>
    expect(exactMinor("0.10") + exactMinor("0,20")).toBe(30n));
  it("rejects excessive precision", () =>
    expect(() => exactMinor("1.001")).toThrow());
  it("does not lower current odometer for historical records", () =>
    expect(
      currentKm(
        { id: "a", purchase_odometer: 1000 } as Vehicle,
        [
          { vehicle_id: "a", odometer: 2000 },
          { vehicle_id: "a", odometer: 1500 },
        ] as Entry[],
      ),
    ).toBe(2000));
  it("keeps currencies separate", () =>
    expect(
      sumEvents([
        { currency: "RUB", amount_minor: 100 },
        { currency: "USD", amount_minor: 200 },
      ] as Entry[]),
    ).toBe(100));
});
