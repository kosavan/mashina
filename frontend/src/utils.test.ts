import { describe, it, expect } from "vitest";
import {
  exactMinor,
  currentKm,
  sumEvents,
  defaultCurrency,
  currencySymbol,
  distanceUnit,
  volumeUnit,
  consumptionUnit,
  money,
} from "./utils";
import type { Entry, State, Vehicle } from "./types";
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
  it("resolves vehicle and global default currencies and unit settings", () => {
    const base = { settings: {} } as unknown as State;
    expect(defaultCurrency(base)).toBe("RUB");
    expect(distanceUnit(base)).toBe("km");
    expect(volumeUnit(base)).toBe("l");
    expect(consumptionUnit(base)).toBe("l_100km");

    const ukState = {
      settings: {
        currency: "GBP",
        distance_unit: "mi",
        volume_unit: "l",
        consumption_unit: "mpg_uk",
      },
    } as unknown as State;
    expect(defaultCurrency(ukState)).toBe("GBP");
    expect(
      defaultCurrency(ukState, { id: "v1", currency: "EUR" } as Vehicle),
    ).toBe("EUR");
    expect(distanceUnit(ukState)).toBe("mi");
    expect(volumeUnit(ukState)).toBe("l");
    expect(consumptionUnit(ukState)).toBe("mpg_uk");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("KZT")).toBe("₸");
    expect(currencySymbol("XYZ")).toBe("XYZ");
    expect(money(12345, "GBP")).toContain("123");
    expect(money(12345, "XYZ")).toContain("123");
  });
});
