import { expect, it } from "vitest";
import { estimatedCost } from "./calculations";
import { projectReminder, reminderStatus } from "./reminders";
import type { Reminder } from "./types";
const base = {
  id: "r",
  version: 1,
  vehicle_id: "v",
  title: "Oil",
  due_date: "2026-10-01",
  due_odometer: 10000,
  enabled: true,
  status: "overdue",
  estimated_cost_minor: 123456,
  cost_currency: "RUB",
} satisfies Reminder;
it("optional estimates distinguish unknown and zero without rounding", () => {
  expect(estimatedCost("1234.56")).toBe(123456);
  expect(estimatedCost("12,34")).toBe(1234);
  expect(estimatedCost("")).toBeNull();
  expect(estimatedCost("0")).toBe(0);
  expect(estimatedCost("10000000000")).toBe(1e12);
  for (const invalid of ["-1", "NaN", "1.001", "10000000000.01"])
    expect(() => estimatedCost(invalid)).toThrow();
});
it("date recurrence clears km and preserves estimate; clearing price is explicit", () => {
  const next = projectReminder(
    { ...base, repeat_days: 30, completion_date: "2026-10-11" },
    "complete",
  );
  expect(next.due_date).toBe("2026-11-10");
  expect(next.due_odometer).toBeNull();
  expect(next.estimated_cost_minor).toBe(123456);
  expect(
    projectReminder({ ...next, estimated_cost: "" }, "update")
      .estimated_cost_minor,
  ).toBeNull();
});
it("km recurrence requires confirmed reading and clears old calendar deadline", () => {
  expect(() =>
    projectReminder({ ...base, repeat_km: 5000 }, "complete"),
  ).toThrow();
  const next = projectReminder(
    { ...base, repeat_km: 5000, completion_odometer: 10001 },
    "complete",
  );
  expect(next.due_date).toBe("");
  expect(next.due_odometer).toBe(15001);
  expect(reminderStatus(next, 10001, "2026-10-12").status).toBe("normal");
});
it("confirmed odometer and calendar OR rules match server, including explicit zero warning", () => {
  expect(
    reminderStatus(
      { ...base, due_date: "2026-10-20", warning_days: 0, due_odometer: null },
      0,
      "2026-10-12",
    ).status,
  ).toBe("normal");
  expect(reminderStatus(base, 10001, "2026-09-01").status).toBe("overdue");
  expect(
    reminderStatus({ ...base, completed_at: "2026-10-11" }, 10001, "2026-10-12")
      .status,
  ).toBe("completed");
});
