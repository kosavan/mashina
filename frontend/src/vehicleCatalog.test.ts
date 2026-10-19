import { describe, it, expect } from "vitest";
import { vehicleSuggestions } from "./vehicleCatalog";

describe("offline vehicle suggestions", () => {
  const saved = [
    {
      id: "custom",
      version: 1,
      brand: "Моя марка",
      model: "Прототип",
      engine: "Особый двигатель",
    },
  ];
  it("filters models and engines by their parents and resolves aliases", () => {
    expect(vehicleSuggestions("model", "volvo", "", [])).toContain("XC60");
    expect(vehicleSuggestions("model", "volvo", "", [])).not.toContain(
      "Octavia",
    );
    expect(vehicleSuggestions("engine", "вольво", "xc60", [])).toContain("D4");
    expect(vehicleSuggestions("engine", "skoda", "Octavia", [])).toContain(
      "1.4 TSI",
    );
    expect(vehicleSuggestions("engine", "Volvo", "unknown", [])).toEqual([]);
  });
  it("includes custom stored values without rewriting user records", () => {
    expect(vehicleSuggestions("brand", "", "", saved)).toContain("Моя марка");
    expect(vehicleSuggestions("model", "Моя марка", "", saved)).toEqual([
      "Прототип",
    ]);
    expect(
      vehicleSuggestions("engine", "Моя марка", "Прототип", saved),
    ).toEqual(["Особый двигатель"]);
    expect(saved[0].engine).toBe("Особый двигатель");
  });
});
