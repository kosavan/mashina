import type { TireSet } from "./types";

export function tireCondition(tire: TireSet, now = new Date()) {
  const code = tire.manufacture_code || "";
  const year = code ? 2000 + Number(code.slice(2)) : null;
  // DOT supplies a manufacture week, not an exact birthday. Never show false day precision.
  const age = year === null ? null : Math.max(0, now.getFullYear() - year);
  const latest = [...(tire.tread_measurements || [])].sort(
    (a, b) =>
      b.measured_at.localeCompare(a.measured_at) ||
      a.depth_tenths - b.depth_tenths,
  )[0];
  const limit = tire.tread_threshold_tenths;
  return {
    year,
    age,
    latest,
    atThreshold: !!latest && limit != null && latest.depth_tenths <= limit,
    tenYears: year !== null && now.getFullYear() - year > 10,
    approachingTen: year !== null && now.getFullYear() - year === 10,
  };
}
