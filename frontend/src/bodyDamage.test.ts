import { describe, expect, it } from "vitest";
import {
  panels,
  pointForPanel,
  visibleDamages,
  viewLabels,
  statusLabels,
  typeLabels,
  severityLabels,
} from "./bodyGeometry";
import english from "./locales/en.json";
import type { BodyDamage } from "./types";

describe("body condition", () => {
  it("offers five keyboard-selectable views with distinct panels and normalized centers", () => {
    expect(Object.keys(panels)).toHaveLength(5);
    for (const shapes of Object.values(panels)) {
      expect(new Set(shapes.map((p) => p.id)).size).toBe(shapes.length);
      for (const shape of shapes) {
        const point = pointForPanel(shape);
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(1);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(1);
        expect(shape.path).toContain("M");
        expect(english).toHaveProperty(shape.label);
      }
    }
    for (const labels of [viewLabels, statusLabels, typeLabels, severityLabels])
      for (const label of Object.values(labels))
        expect(english).toHaveProperty(label);
  });
  it("isolates cars and deleted issues, keeps multiple markers and filters repaired history", () => {
    const rows = [
      {
        id: "a",
        vehicle_id: "car",
        status: "observed",
        discovered_on: "2026-01-02",
      },
      {
        id: "b",
        vehicle_id: "car",
        status: "repaired",
        discovered_on: "2026-01-01",
      },
      {
        id: "c",
        vehicle_id: "other",
        status: "observed",
        discovered_on: "2026-01-03",
      },
      {
        id: "d",
        vehicle_id: "car",
        status: "observed",
        deleted: true,
        discovered_on: "2026-01-03",
      },
      {
        id: "e",
        vehicle_id: "car",
        status: "observed",
        discovered_on: "2026-01-02",
      },
    ] as BodyDamage[];
    expect(visibleDamages(rows, "car", "unresolved").map((r) => r.id)).toEqual([
      "a",
      "e",
    ]);
    expect(visibleDamages(rows, "car", "repaired").map((r) => r.id)).toEqual([
      "b",
    ]);
    expect(visibleDamages(rows, "car", "all")).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
