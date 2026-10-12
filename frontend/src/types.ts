export type Kind = "expense" | "fuel" | "maintenance" | "odometer" | "note";
export interface RecordBase {
  id: string;
  version: number;
  deleted?: boolean;
  can_edit?: boolean;
  created_by?: string;
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
  estimated_cost_minor?: number | null;
  cost_currency?: string;
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
  created_by?: string;
  visibility?: "owner" | "shared";
  can_edit?: boolean;
  can_share?: boolean;
}
export interface TireInterval {
  mounted_at: string;
  mounted_km: number;
  removed_at: string;
  removed_km: number | null;
}
export interface TireSet extends RecordBase {
  vehicle_id: string;
  brand: string;
  model: string;
  size: string;
  season: "summer" | "winter" | "all";
  intervals: TireInterval[];
  confirmed_km: number;
  manufacture_code?: string;
  tread_threshold_tenths?: number | null;
  tread_measurements?: {
    id: string;
    measured_at: string;
    depth_tenths: number;
    notes: string;
  }[];
  notes: string;
}
export interface Budget extends RecordBase {
  vehicle_id: string;
  month: string;
  amount_minor: number;
  currency: string;
  category: string;
}
export interface RecurringCost extends RecordBase {
  vehicle_id: string;
  title: string;
  amount_minor: number;
  currency: string;
  category: string;
  next_date: string;
  interval_months: number;
  enabled: boolean;
}
export interface State {
  vehicles: Vehicle[];
  events: Entry[];
  categories: RecordBase[];
  reminders: Reminder[];
  attachments: Attachment[];
  tire_sets?: TireSet[];
  budgets?: Budget[];
  recurring_costs?: RecurringCost[];
  settings: Record<string, any>;
}
export interface Session {
  id: string;
  username: string;
  csrf: string;
  demo: boolean;
  is_admin?: boolean;
}
export interface Mutation {
  operation_id: string;
  id: string;
  entity:
    | "vehicle"
    | "event"
    | "category"
    | "reminder"
    | "settings"
    | "tire_set"
    | "budget"
    | "recurring_cost";
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
  | "fuel-analytics"
  | "tires"
  | "maintenance"
  | "analytics"
  | "documents"
  | "reminders"
  | "settings";
