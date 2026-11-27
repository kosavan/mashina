import { describe, expect, it } from "vitest";
import { fuelPreview, pendingMoney } from "./calculations";
describe("exact optimistic money", () => {
  it("rounds each discounted position before summing and applies adjustment", () => {
    expect(
      pendingMoney({
        kind: "maintenance",
        items: [
          { quantity: "3", unit_price: "0.105", discount: "0.01" },
          { quantity: "2", unit_price: "1234.56", discount: "10.12" },
        ],
        adjustment: "-0.01",
      }),
    ).toBe(245930);
  });
  it("derives fuel total without floating-point drift", () => {
    expect(
      pendingMoney({ kind: "fuel", liters: "42.13", price: "61.27" }),
    ).toBe(258131);
    expect(
      pendingMoney({ kind: "fuel", amount: "1000.01", price: "61.27" }),
    ).toBe(100001);
  });
  it("previews only missing fill-up values at the server rounding precision", () => {
    expect(fuelPreview({ liters: "0.5", price: "2.01", amount: "" })).toEqual({
      field: "amount",
      value: 101,
    });
    expect(fuelPreview({ liters: "", price: "12", amount: "2" })).toEqual({
      field: "liters",
      value: 0.167,
    });
    expect(fuelPreview({ liters: "32", price: "", amount: "1" })).toEqual({
      field: "price",
      value: 0.0313,
    });
    expect(fuelPreview({ liters: "20", price: "0", amount: "" })).toBeNull();
    expect(fuelPreview({ liters: "20", price: "2", amount: "40" })).toBeNull();
  });
});
