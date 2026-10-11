import { createContext, useContext } from "react";
import type {
  Attachment,
  Kind,
  Mutation,
  Page,
  RecordBase,
  Session,
  State,
} from "./types";
export interface AppModel {
  state: State;
  session: Session;
  selected: string;
  setSelected: (id: string) => void;
  page: Page;
  setPage: (page: Page) => void;
  open: (
    type: Kind | "vehicle" | "reminder" | "document" | "category" | "quick",
    record?: RecordBase,
  ) => void;
  save: (
    entity: Mutation["entity"],
    data: Record<string, any>,
    record?: RecordBase,
    action?: Mutation["action"],
  ) => Promise<RecordBase>;
  refresh: () => Promise<void>;
  notify: (message: string, action?: () => void) => void;
  upload: (file: File, data: Record<string, string>) => Promise<Attachment>;
  logout: () => Promise<void>;
  queue: Mutation[];
  sync: () => Promise<void>;
  resetDemo: () => Promise<void>;
}
export const AppContext = createContext<AppModel | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing app context");
  return value;
}
