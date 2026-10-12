import { describe, it, expect } from "vitest";
import { reviewSummary, selectedDecisions, type BankRow } from "./bankReview";

const row = (id: number, currency = "RUB", amount = 101): BankRow => ({
  row_id: id,
  data: {
    date: "2026-10-01",
    amount_minor: amount,
    signed_minor: -amount,
    currency,
    description: "Synthetic",
    transaction_id: String(id),
  },
  error: "",
  processed: false,
  conflict: false,
  overlap: false,
  candidate_count: 0,
  candidates: [],
});
describe("deliberate bank review", () => {
  it("never selects or creates money by default", () => {
    expect(selectedDecisions({})).toEqual([]);
    expect(reviewSummary([row(1)], {}).unresolved).toBe(1);
  });
  it("sums only new amounts exactly and separately by currency", () => {
    const rows = [
      row(1),
      row(2, "RUB", 202),
      row(3, "EUR", 99),
      row(4),
      row(5),
    ];
    const summary = reviewSummary(rows, {
      1: { row_id: 1, action: "create" },
      2: { row_id: 2, action: "create" },
      3: { row_id: 3, action: "create" },
      4: { row_id: 4, action: "link" },
      5: { row_id: 5, action: "ignore" },
    });
    expect(summary.totals).toEqual({ RUB: "303", EUR: "99" });
    expect(summary).toMatchObject({
      created: 3,
      linked: 1,
      ignored: 1,
      unresolved: 0,
    });
  });
  it("keeps processed/conflict rows out of unresolved choices", () => {
    const summary = reviewSummary(
      [
        { ...row(1), processed: true },
        { ...row(2), conflict: true },
      ],
      {},
    );
    expect(summary.processed).toBe(1);
    expect(summary.unresolved).toBe(0);
  });
});
