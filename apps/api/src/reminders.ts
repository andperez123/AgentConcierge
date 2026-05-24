import type {
  CreateReminderBody,
  Reminder,
  UpdateReminderBody,
} from "@concierge/shared";
import { db } from "./db.js";
import { emitDashboardEvent } from "./dashboard/events.js";

type ReminderRow = {
  id: number;
  text: string;
  due_at: string | null;
  created_at: string;
  source: string | null;
  dismissed_at: string | null;
  project_id: string | null;
};

const SELECT_COLS = `id, text, due_at, created_at, source, dismissed_at, project_id`;

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    text: row.text,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    source: row.source ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
    projectId: row.project_id ?? undefined,
  };
}

function notifyState(): void {
  emitDashboardEvent("state-changed", {});
}

export function listReminders(projectId?: string): Reminder[] {
  const sql = projectId
    ? `SELECT ${SELECT_COLS} FROM reminders
       WHERE dismissed_at IS NULL AND project_id = ?
       ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, created_at DESC
       LIMIT 20`
    : `SELECT ${SELECT_COLS} FROM reminders
       WHERE dismissed_at IS NULL
       ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, created_at DESC
       LIMIT 20`;
  const rows = (
    projectId
      ? db.prepare(sql).all(projectId)
      : db.prepare(sql).all()
  ) as ReminderRow[];
  return rows.map(rowToReminder);
}

export function listCompletedReminders(projectId?: string): Reminder[] {
  const sql = projectId
    ? `SELECT ${SELECT_COLS} FROM reminders
       WHERE dismissed_at IS NOT NULL AND project_id = ?
       ORDER BY dismissed_at DESC LIMIT 50`
    : `SELECT ${SELECT_COLS} FROM reminders
       WHERE dismissed_at IS NOT NULL
       ORDER BY dismissed_at DESC LIMIT 50`;
  const rows = (
    projectId
      ? db.prepare(sql).all(projectId)
      : db.prepare(sql).all()
  ) as ReminderRow[];
  return rows.map(rowToReminder);
}

export function countActiveReminders(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM reminders WHERE dismissed_at IS NULL`)
    .get() as { c: number };
  return row.c;
}

export function countCompletedReminders(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM reminders WHERE dismissed_at IS NOT NULL`,
    )
    .get() as { c: number };
  return row.c;
}

export function getReminder(id: number): Reminder | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLS} FROM reminders WHERE id = ?`)
    .get(id) as ReminderRow | undefined;
  return row ? rowToReminder(row) : null;
}

export function createReminder(body: CreateReminderBody): Reminder {
  const text = body.text.trim();
  if (!text) throw new Error("Reminder text is required");
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO reminders (text, due_at, created_at, source, project_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      text,
      body.dueAt ?? null,
      now,
      body.source ?? "dashboard",
      body.projectId ?? null,
    );
  const row = db
    .prepare(`SELECT ${SELECT_COLS} FROM reminders WHERE id = ?`)
    .get(result.lastInsertRowid) as ReminderRow;
  const reminder = rowToReminder(row);
  notifyState();
  return reminder;
}

export function updateReminder(
  id: number,
  body: UpdateReminderBody,
): Reminder | null {
  const existing = getReminder(id);
  if (!existing || existing.dismissedAt) return null;

  const text =
    body.text !== undefined ? body.text.trim() : existing.text;
  if (!text) throw new Error("Reminder text is required");

  const dueAt =
    body.dueAt === null
      ? null
      : body.dueAt !== undefined
        ? body.dueAt
        : (existing.dueAt ?? null);

  const projectId =
    body.projectId === null
      ? null
      : body.projectId !== undefined
        ? body.projectId
        : (existing.projectId ?? null);

  db.prepare(
    `UPDATE reminders SET text = ?, due_at = ?, project_id = ? WHERE id = ?`,
  ).run(text, dueAt, projectId, id);

  const updated = getReminder(id);
  if (updated) notifyState();
  return updated;
}

export function dismissReminder(id: number): boolean {
  const result = db
    .prepare(
      `UPDATE reminders SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL`,
    )
    .run(new Date().toISOString(), id);
  if (result.changes > 0) notifyState();
  return result.changes > 0;
}
