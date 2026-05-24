import type { CreateNoteBody, Note, UpdateNoteBody } from "@concierge/shared";
import { db } from "./db.js";
import { emitDashboardEvent } from "./dashboard/events.js";

type NoteRow = {
  id: number;
  text: string;
  created_at: string;
  source: string | null;
  pinned: number;
  project_id: string | null;
  dismissed_at: string | null;
};

const SELECT_COLS = `id, text, created_at, source, pinned, project_id, dismissed_at`;

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    source: row.source ?? undefined,
    pinned: row.pinned === 1,
    projectId: row.project_id ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
  };
}

function notifyState(): void {
  emitDashboardEvent("state-changed", {});
}

export function listNotes(projectId?: string): Note[] {
  const sql = projectId
    ? `SELECT ${SELECT_COLS} FROM notes
       WHERE dismissed_at IS NULL AND project_id = ?
       ORDER BY pinned DESC, created_at DESC LIMIT 20`
    : `SELECT ${SELECT_COLS} FROM notes
       WHERE dismissed_at IS NULL
       ORDER BY pinned DESC, created_at DESC LIMIT 20`;
  const rows = (
    projectId ? db.prepare(sql).all(projectId) : db.prepare(sql).all()
  ) as NoteRow[];
  return rows.map(rowToNote);
}

export function listCompletedNotes(projectId?: string): Note[] {
  const sql = projectId
    ? `SELECT ${SELECT_COLS} FROM notes
       WHERE dismissed_at IS NOT NULL AND project_id = ?
       ORDER BY dismissed_at DESC LIMIT 50`
    : `SELECT ${SELECT_COLS} FROM notes
       WHERE dismissed_at IS NOT NULL
       ORDER BY dismissed_at DESC LIMIT 50`;
  const rows = (
    projectId ? db.prepare(sql).all(projectId) : db.prepare(sql).all()
  ) as NoteRow[];
  return rows.map(rowToNote);
}

export function countActiveNotes(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM notes WHERE dismissed_at IS NULL`)
    .get() as { c: number };
  return row.c;
}

export function countCompletedNotes(): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM notes WHERE dismissed_at IS NOT NULL`)
    .get() as { c: number };
  return row.c;
}

export function getNote(id: number): Note | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLS} FROM notes WHERE id = ?`)
    .get(id) as NoteRow | undefined;
  return row ? rowToNote(row) : null;
}

export function createNote(body: CreateNoteBody): Note {
  const text = body.text.trim();
  if (!text) throw new Error("Note text is required");
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO notes (text, created_at, source, pinned, project_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      text,
      now,
      body.source ?? "dashboard",
      body.pinned ? 1 : 0,
      body.projectId ?? null,
    );
  const row = db
    .prepare(`SELECT ${SELECT_COLS} FROM notes WHERE id = ?`)
    .get(result.lastInsertRowid) as NoteRow;
  const note = rowToNote(row);
  notifyState();
  return note;
}

export function updateNote(id: number, body: UpdateNoteBody): Note | null {
  const existing = getNote(id);
  if (!existing || existing.dismissedAt) return null;

  const text =
    body.text !== undefined ? body.text.trim() : existing.text;
  if (!text) throw new Error("Note text is required");

  const pinned = body.pinned !== undefined ? body.pinned : existing.pinned;
  const projectId =
    body.projectId === null
      ? null
      : body.projectId !== undefined
        ? body.projectId
        : (existing.projectId ?? null);

  db.prepare(
    `UPDATE notes SET text = ?, pinned = ?, project_id = ? WHERE id = ?`,
  ).run(text, pinned ? 1 : 0, projectId, id);

  const updated = getNote(id);
  if (updated) notifyState();
  return updated;
}

export function dismissNote(id: number): boolean {
  const result = db
    .prepare(
      `UPDATE notes SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL`,
    )
    .run(new Date().toISOString(), id);
  if (result.changes > 0) notifyState();
  return result.changes > 0;
}
