import { randomUUID } from "node:crypto";
import type { CalendarEvent, CalendarEventInput } from "@concierge/shared";
import { db, getSnapshot, saveSnapshot } from "../db.js";
import { emitDashboardEvent } from "../dashboard/events.js";

const LAST_SYNC_KEY = "calendar:lastSync";

type CalendarRow = {
  id: string;
  google_id: string | null;
  calendar_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: number;
  status: string | null;
  html_link: string | null;
  color: string | null;
  source: string | null;
  updated_at: string;
};

const SELECT_COLS = `id, google_id, calendar_id, title, description, location,
  start_at, end_at, all_day, status, html_link, color, source, updated_at`;

function rowToEvent(row: CalendarRow): CalendarEvent {
  return {
    id: row.id,
    googleId: row.google_id ?? undefined,
    calendarId: row.calendar_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    start: row.start_at,
    end: row.end_at ?? undefined,
    allDay: row.all_day === 1,
    status: row.status ?? undefined,
    htmlLink: row.html_link ?? undefined,
    color: row.color ?? undefined,
    source: row.source ?? undefined,
    updatedAt: row.updated_at,
  };
}

function notifyState(): void {
  emitDashboardEvent("state-changed", {});
}

/** List events overlapping [from, to). Both bounds optional (ISO strings). */
export function listCalendarEvents(
  from?: string,
  to?: string,
): CalendarEvent[] {
  const clauses: string[] = [`status IS NULL OR status != 'cancelled'`];
  const params: string[] = [];
  // An event overlaps the window when it starts before `to` and ends after `from`.
  if (to) {
    clauses.push(`start_at < ?`);
    params.push(to);
  }
  if (from) {
    clauses.push(`COALESCE(end_at, start_at) >= ?`);
    params.push(from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLS} FROM calendar_events ${where}
       ORDER BY start_at ASC, title ASC`,
    )
    .all(...params) as CalendarRow[];
  return rows.map(rowToEvent);
}

export function getCalendarEvent(id: string): CalendarEvent | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLS} FROM calendar_events WHERE id = ?`)
    .get(id) as CalendarRow | undefined;
  return row ? rowToEvent(row) : null;
}

function normalizeInput(input: CalendarEventInput): {
  title: string;
  start: string;
  end: string | null;
  allDay: number;
} {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("Event title is required");
  const start = (input.start ?? "").trim();
  if (!start) throw new Error("Event start is required");
  return {
    title,
    start,
    end: input.end?.trim() || null,
    allDay: input.allDay ? 1 : 0,
  };
}

/**
 * Insert or update a single event. When `googleId` is supplied and already
 * exists, the existing row is updated in place (so re-syncing keeps ids stable).
 */
export function upsertCalendarEvent(input: CalendarEventInput): CalendarEvent {
  const { title, start, end, allDay } = normalizeInput(input);
  const now = new Date().toISOString();

  const existingId = input.googleId
    ? (
        db
          .prepare(`SELECT id FROM calendar_events WHERE google_id = ?`)
          .get(input.googleId) as { id: string } | undefined
      )?.id
    : undefined;

  const id = existingId ?? randomUUID();

  db.prepare(
    `INSERT INTO calendar_events
       (id, google_id, calendar_id, title, description, location,
        start_at, end_at, all_day, status, html_link, color, source, updated_at)
     VALUES (@id, @google_id, @calendar_id, @title, @description, @location,
        @start_at, @end_at, @all_day, @status, @html_link, @color, @source, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
        google_id = excluded.google_id,
        calendar_id = excluded.calendar_id,
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        all_day = excluded.all_day,
        status = excluded.status,
        html_link = excluded.html_link,
        color = excluded.color,
        source = excluded.source,
        updated_at = excluded.updated_at`,
  ).run({
    id,
    google_id: input.googleId ?? null,
    calendar_id: input.calendarId ?? null,
    title,
    description: input.description ?? null,
    location: input.location ?? null,
    start_at: start,
    end_at: end,
    all_day: allDay,
    status: input.status ?? null,
    html_link: input.htmlLink ?? null,
    color: input.color ?? null,
    source: input.source ?? "agent",
    updated_at: now,
  });

  const event = getCalendarEvent(id);
  if (!event) throw new Error("Failed to persist event");
  return event;
}

/** Remove google-sourced events whose start falls within [start, end). */
export function clearGoogleEventsInRange(start: string, end: string): number {
  const result = db
    .prepare(
      `DELETE FROM calendar_events
       WHERE source = 'google' AND start_at >= ? AND start_at < ?`,
    )
    .run(start, end);
  return result.changes;
}

/**
 * Bulk sync: optionally clear a google window first, then upsert everything.
 * Used by the agent after pulling Google Calendar.
 */
export function syncCalendarEvents(
  events: CalendarEventInput[],
  replaceRange?: { start: string; end: string },
): { upserted: number; cleared: number } {
  const tx = db.transaction(() => {
    let cleared = 0;
    if (replaceRange?.start && replaceRange?.end) {
      cleared = clearGoogleEventsInRange(replaceRange.start, replaceRange.end);
    }
    let upserted = 0;
    for (const ev of events) {
      upsertCalendarEvent({ source: "google", ...ev });
      upserted += 1;
    }
    return { upserted, cleared };
  });
  const result = tx();
  setLastSyncAt(new Date().toISOString());
  notifyState();
  return result;
}

export function createCalendarEvent(input: CalendarEventInput): CalendarEvent {
  const event = upsertCalendarEvent({ source: "dashboard", ...input });
  notifyState();
  return event;
}

export function deleteCalendarEvent(id: string): boolean {
  const result = db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(id);
  if (result.changes > 0) notifyState();
  return result.changes > 0;
}

export function setLastSyncAt(at: string): void {
  saveSnapshot(LAST_SYNC_KEY, JSON.stringify({ at }));
}

export function getLastSyncAt(): string | undefined {
  const snap = getSnapshot(LAST_SYNC_KEY);
  if (!snap) return undefined;
  try {
    return (JSON.parse(snap.json) as { at?: string }).at;
  } catch {
    return undefined;
  }
}

export function countEventsInRange(from: string, to: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM calendar_events
       WHERE start_at < ? AND COALESCE(end_at, start_at) >= ?
         AND (status IS NULL OR status != 'cancelled')`,
    )
    .get(to, from) as { c: number };
  return row.c;
}
