import { describe, it, expect } from "vitest";
import { tireCondition } from "./tires";
import type { TireSet } from "./types";

describe("tire evidence", () => {
  const base = {
    id: "t",
    version: 1,
    brand: "Example",
    season: "winter",
    intervals: [],
    confirmed_km: 0,
  } as unknown as TireSet;
  it("never invents measurements or age from mileage", () => {
    const result = tireCondition({ ...base, confirmed_km: 80000 });
    expect(result.age).toBeNull();
    expect(result.latest).toBeUndefined();
    expect(result.atThreshold).toBe(false);
  });
  it("uses dated measurements rather than their input order", () => {
    const result = tireCondition(
      {
        ...base,
        manufacture_code: "3415",
        tread_threshold_tenths: 40,
        tread_measurements: [
          { id: "a", measured_at: "2026-01-02", depth_tenths: 39, notes: "" },
          { id: "b", measured_at: "2025-01-01", depth_tenths: 70, notes: "" },
        ],
      },
      new Date("2026-10-12"),
    );
    expect(result.latest.depth_tenths).toBe(39);
    expect(result.atThreshold).toBe(true);
    expect(result.tenYears).toBe(true);
  });
  it("uses the minimum of measurements on the same latest date", () => {
    const result = tireCondition({
      ...base,
      tread_measurements: [
        { id: "z", measured_at: "2026-01-02", depth_tenths: 60, notes: "" },
        { id: "a", measured_at: "2026-01-02", depth_tenths: 39, notes: "" },
      ],
    });
    expect(result.latest.depth_tenths).toBe(39);
  });
});
