import type {
  Entry,
  InspectionStatus,
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
