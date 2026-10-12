import type { Mutation, State } from "./types";

export function permissionError(
  state: State,
  operation: Mutation,
): string | undefined {
  if (operation.entity === "settings" || operation.entity === "category")
    return;
  const tables = {
    vehicle: "vehicles",
    event: "events",
    reminder: "reminders",
    tire_set: "tire_sets",
    budget: "budgets",
    recurring_cost: "recurring_costs",
    body_damage: "body_damages",
  } as const;
  const rows = state[tables[operation.entity]] || [];
  const row = rows.find((r) => r.id === operation.id);
  if (operation.action !== "create" && (!row || row.can_edit === false))
    return "Нет прав на изменение этой записи. Черновик сохранён.";
  if (operation.entity === "vehicle") return;
  const car = state.vehicles.find(
    (v) => v.id === (row?.vehicle_id || operation.data.vehicle_id),
  );
  if (!car || (operation.entity !== "event" && car.can_edit === false))
    return "Доступ к автомобилю изменён. Черновик сохранён.";
}

export function scopeKey(state: State) {
  return JSON.stringify([
    state.vehicles.map((v) => [v.id, v.role, v.can_edit]).sort(),
    state.attachments.map((a) => [a.id, a.visibility, a.can_edit]).sort(),
  ]);
}
