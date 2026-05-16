import type { CreateReminderBody, Reminder } from "@concierge/shared";
import { db } from "./db.js";

function rowToReminder(row: {
  id: number;
  text: string;
  due_at: string | null;
  created_at: string;
  source: string | null;
  dismissed_at: string | null;
}): Reminder {
  return {
    id: row.id,
    text: row.text,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    source: row.source ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
  };
}

export function listReminders(): Reminder[] {
  const rows = db
    .prepare(
      `SELECT id, text, due_at, created_at, source, dismissed_at
       FROM reminders
       WHERE dismissed_at IS NULL
       ORDER BY
         CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
         due_at ASC,
         created_at DESC
       LIMIT 20`,
    )
    .all() as Array<{
    id: number;
    text: string;
    due_at: string | null;
    created_at: string;
    source: string | null;
    dismissed_at: string | null;
  }>;
  return rows.map(rowToReminder);
}

export function createReminder(body: CreateReminderBody): Reminder {
  const text = body.text.trim();
  if (!text) throw new Error("Reminder text is required");
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO reminders (text, due_at, created_at, source)
       VALUES (?, ?, ?, ?)`,
    )
    .run(text, body.dueAt ?? null, now, body.source ?? "openclaw");
  const row = db
    .prepare(
      `SELECT id, text, due_at, created_at, source, dismissed_at FROM reminders WHERE id = ?`,
    )
    .get(result.lastInsertRowid) as {
    id: number;
    text: string;
    due_at: string | null;
    created_at: string;
    source: string | null;
    dismissed_at: string | null;
  };
  return rowToReminder(row);
}

export function dismissReminder(id: number): boolean {
  const result = db
    .prepare(
      `UPDATE reminders SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL`,
    )
    .run(new Date().toISOString(), id);
  return result.changes > 0;
}
