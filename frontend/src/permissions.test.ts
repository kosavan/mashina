import { describe, expect, it } from "vitest";
import { permissionError } from "./permissions";
import type { Mutation, State } from "./types";
const state = {
  vehicles: [{ id: "car", role: "driver", can_edit: false }],
  events: [
    { id: "own", vehicle_id: "car", can_edit: true },
    { id: "other", vehicle_id: "car", can_edit: false },
  ],
  categories: [],
  reminders: [],
  attachments: [],
  settings: {},
} as unknown as State;
function operation(
  entity: Mutation["entity"],
  id = "new",
  action: Mutation["action"] = "create",
): Mutation {
  return {
    operation_id: "op",
    id,
    entity,
    action,
    data: { vehicle_id: "car" },
  };
}
describe("offline permissions", () => {
  it("allows driver quick add and own edits but denies foreign writes and owner tools", () => {
    expect(permissionError(state, operation("event"))).toBeUndefined();
    expect(
      permissionError(state, operation("event", "own", "update")),
    ).toBeUndefined();
    expect(
      permissionError(state, operation("event", "other", "update")),
    ).toBeTruthy();
    expect(permissionError(state, operation("reminder"))).toBeTruthy();
    expect(permissionError(state, operation("budget"))).toBeTruthy();
  });
  it("stops revoked operations while allowing local categories and new owned cars", () => {
    expect(
      permissionError(
        { ...state, vehicles: [], events: [] },
        operation("event"),
      ),
    ).toBeTruthy();
    expect(permissionError(state, operation("vehicle"))).toBeUndefined();
    expect(permissionError(state, operation("category"))).toBeUndefined();
  });
});
