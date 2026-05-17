import type { Note, Reminder } from "@concierge/shared";

export type WorkItem =
  | { kind: "reminder"; item: Reminder }
  | { kind: "note"; item: Note };
