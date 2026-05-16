import type { CreateNoteBody, Note } from "@concierge/shared";
import { db } from "./db.js";

function rowToNote(row: {
  id: number;
  text: string;
  created_at: string;
  source: string | null;
  pinned: number;
}): Note {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    source: row.source ?? undefined,
    pinned: row.pinned === 1,
  };
}

export function listNotes(): Note[] {
  const rows = db
    .prepare(
      `SELECT id, text, created_at, source, pinned FROM notes
       ORDER BY pinned DESC, created_at DESC LIMIT 10`,
    )
    .all() as Array<{
    id: number;
    text: string;
    created_at: string;
    source: string | null;
    pinned: number;
  }>;
  return rows.map(rowToNote);
}

export function createNote(body: CreateNoteBody): Note {
  const text = body.text.trim();
  if (!text) throw new Error("Note text is required");
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO notes (text, created_at, source, pinned) VALUES (?, ?, ?, ?)`,
    )
    .run(
      text,
      now,
      body.source ?? "openclaw",
      body.pinned ? 1 : 0,
    );
  const row = db
    .prepare(`SELECT id, text, created_at, source, pinned FROM notes WHERE id = ?`)
    .get(result.lastInsertRowid) as {
    id: number;
    text: string;
    created_at: string;
    source: string | null;
    pinned: number;
  };
  return rowToNote(row);
}

export function dismissNote(id: number): boolean {
  const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  return result.changes > 0;
}
