import type {
  Entry,
  InspectionStatus,
  Reminder,
  RenewalData,
  RenewalType,
} from "./types";

export const renewalLabels: Record<RenewalType, string> = {
  registration: "Регистрация",
  insurance: "Страховка",
};

export const inspectionLabels: Record<InspectionStatus, string> = {
  pending: "Ещё не пройден",
  passed: "Пройден",
  failed: "Не пройден",
};

export function renewalHistory(entries: Entry[], vehicleId: string) {
  return entries
    .filter(
      (entry): entry is Entry & { renewal: RenewalData } =>
        !entry.deleted &&
        entry.kind === "expense" &&
        entry.vehicle_id === vehicleId &&
        (entry.renewal?.type === "registration" ||
          entry.renewal?.type === "insurance"),
    )
    .sort(
      (a, b) =>
        b.occurred_at.localeCompare(a.occurred_at) ||
        b.renewal.expires_on.localeCompare(a.renewal.expires_on) ||
        a.id.localeCompare(b.id),
    );
}

export function expiresInDays(expires: string, day: string) {
  return (
    (Date.parse(expires + "T12:00:00Z") - Date.parse(day + "T12:00:00Z")) /
    86_400_000
  );
}

export function projectRenewalReminder(reminder: Reminder, entries: Entry[]) {
  const schedule = reminder.renewal_schedule;
  if (!schedule) return reminder;
  const latest = renewalHistory(entries, reminder.vehicle_id).find(
    (entry) => entry.renewal.type === schedule.type,
  );
  const cycle = latest ? `${latest.id}:${latest.renewal.expires_on}` : "";
  return {
    ...reminder,
    warning_days: schedule.lead_days,
    due_date: latest?.renewal.expires_on ?? "",
    renewal_cycle: cycle,
    renewal_active: !!cycle,
    completed_at:
      cycle && cycle === reminder.renewal_completed_for
        ? reminder.renewal_completed_at
        : "",
  };
}
