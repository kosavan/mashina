export type Kind = "expense" | "fuel" | "maintenance" | "odometer" | "note";
export interface RecordBase {
  id: string;
  version: number;
  deleted?: boolean;
  [key: string]: any;
}
export interface Vehicle extends RecordBase {
  name: string;
  year?: number;
  status: "active" | "archived" | "sold";
  purchase_odometer: number;
  current_odometer: number;
  photo_id?: string;
  currency: string;
}
export interface Entry extends RecordBase {
  vehicle_id: string;
  kind: Kind;
  occurred_at: string;
  amount_minor: number;
  currency: string;
  description: string;
  odometer: number | null;
  items: Item[];
}
export interface Item {
  name: string;
  part_number: string;
  quantity: string;
  unit_price: string;
  discount: string;
  amount_minor?: number;
}
export interface Reminder extends RecordBase {
  vehicle_id: string;
  title: string;
  due_date: string;
  due_odometer: number | null;
  enabled: boolean;
  status: string;
  remaining_km?: number;
  remaining_days?: number;
}
export interface Attachment {
  id: string;
  vehicle_id: string;
  event_id?: string;
  title: string;
  original_name: string;
  media_type: string;
  size: number;
  document_type: string;
  issued: string;
  expires: string;
  notes: string;
}
export interface State {
  vehicles: Vehicle[];
  events: Entry[];
  categories: RecordBase[];
  reminders: Reminder[];
  attachments: Attachment[];
  settings: Record<string, any>;
}
export interface Session {
  id: string;
  username: string;
  csrf: string;
  demo: boolean;
}
export interface Mutation {
  operation_id: string;
  id: string;
  entity: "vehicle" | "event" | "category" | "reminder" | "settings";
  action: "create" | "update" | "delete" | "restore" | "complete";
  expected_version?: number;
  data: Record<string, any>;
  error?: string;
  status?: number;
}
export interface Cached {
  session: Session;
  state: State;
}
export type Page =
  | "garage"
  | "vehicle"
  | "timeline"
  | "fuel"
  | "maintenance"
  | "analytics"
  | "documents"
  | "reminders"
  | "settings";
