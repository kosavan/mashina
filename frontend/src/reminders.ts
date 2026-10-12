import { estimatedCost } from "./calculations";
import { today } from "./utils";
import type { Reminder, Mutation } from "./types";

export function projectReminder(
  record: Reminder,
  action: Mutation["action"],
  input: Record<string, unknown> = record,
): Reminder {
  const result = { ...record };
  if ("estimated_cost" in result) {
    result.estimated_cost_minor = estimatedCost(result.estimated_cost);
    delete result.estimated_cost;
  }
  result.cost_currency = String(result.cost_currency || "RUB").toUpperCase();
  result.enabled = result.enabled !== false;
  if (!/^[A-Z]{3}$/.test(result.cost_currency))
    throw new Error("Валюта: трёхбуквенный код");
  if (action === "complete") {
    const date = String(input.completion_date || today()).slice(0, 10);
    const days = Number(result.repeat_days || 0),
      km = Number(result.repeat_km || 0);
    if (days || km) {
      if (days) {
        const next = new Date(date + "T12:00:00Z");
        next.setUTCDate(next.getUTCDate() + days);
        result.due_date = next.toISOString().slice(0, 10);
      } else result.due_date = "";
      if (km) {
        const reading = input.completion_odometer;
        if (
          reading === "" ||
          reading == null ||
          !Number.isInteger(Number(reading)) ||
          Number(reading) < 0 ||
          Number(reading) > 3000000
        )
          throw new Error("Укажите подтверждённый пробег при выполнении");
        result.due_odometer = Number(reading) + km;
      } else result.due_odometer = null;
      result.completed_at = "";
    } else result.completed_at = date;
  }
  delete result.completion_date;
  delete result.completion_odometer;
  return result;
}

export function reminderStatus(
  reminder: Reminder,
  odometer: number,
  day: string,
) {
  const remaining_km =
    reminder.due_odometer == null || String(reminder.due_odometer) === ""
      ? null
      : Number(reminder.due_odometer) - odometer;
  const remaining_days = reminder.due_date
    ? Math.round(
        (Date.parse(reminder.due_date.slice(0, 10) + "T12:00:00Z") -
          Date.parse(day + "T12:00:00Z")) /
          86400000,
      )
    : null;
  let status = "normal";
  if (
    (remaining_km != null && remaining_km <= 0) ||
    (remaining_days != null && remaining_days <= 0)
  )
    status = "overdue";
  else if (
    (remaining_km != null &&
      remaining_km <= Number(reminder.warning_km ?? 1000)) ||
    (remaining_days != null &&
      remaining_days <= Number(reminder.warning_days ?? 30))
  )
    status = "soon";
  if (!reminder.enabled) status = "disabled";
  if (reminder.completed_at) status = "completed";
  return { status, remaining_km, remaining_days };
}
