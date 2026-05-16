import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Operation, OperationState, RestartEvent } from "@concierge/shared";
import { DATA_DIR } from "./config.js";
import { randomUUID } from "node:crypto";

mkdirSync(DATA_DIR, { recursive: true });

const dbPath = join(DATA_DIR, "concierge.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS restart_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    trigger TEXT NOT NULL,
    exit_code INTEGER,
    message TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    due_at TEXT,
    created_at TEXT NOT NULL,
    source TEXT,
    dismissed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    source TEXT,
    pinned INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    state TEXT NOT NULL,
    message TEXT,
    accepted_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    result_json TEXT,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    acked_at TEXT,
    actions_json TEXT
  );
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    operation_id TEXT
  );
  CREATE TABLE IF NOT EXISTS doctor_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    exit_code INTEGER,
    summary TEXT
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    key TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dashboard_commands (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivered_at TEXT
  );
`);

export function recordRestart(
  trigger: string,
  exitCode: number | null,
  message: string,
): void {
  db.prepare(
    `INSERT INTO restart_events (at, trigger, exit_code, message) VALUES (?, ?, ?, ?)`,
  ).run(new Date().toISOString(), trigger, exitCode, message);
}

export function getLastRestartAt(): string | undefined {
  const row = db
    .prepare(`SELECT at FROM restart_events ORDER BY id DESC LIMIT 1`)
    .get() as { at: string } | undefined;
  return row?.at;
}

export function listRestartEvents(limit = 20): RestartEvent[] {
  const rows = db
    .prepare(
      `SELECT id, at, trigger, exit_code, message FROM restart_events ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    at: string;
    trigger: string;
    exit_code: number | null;
    message: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    trigger: r.trigger,
    exitCode: r.exit_code,
    message: r.message,
  }));
}

export function createOperation(type: string): Operation {
  const id = randomUUID();
  const acceptedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO operations (id, type, state, accepted_at) VALUES (?, ?, 'queued', ?)`,
  ).run(id, type, acceptedAt);
  return { id, type, state: "queued", acceptedAt };
}

export function updateOperation(
  id: string,
  patch: Partial<{
    state: OperationState;
    message: string;
    startedAt: string;
    finishedAt: string;
    error: string;
    resultJson: string;
  }>,
): void {
  const row = getOperation(id);
  if (!row) return;
  const state = patch.state ?? row.state;
  const message = patch.message ?? row.message;
  const startedAt = patch.startedAt ?? row.startedAt;
  const finishedAt = patch.finishedAt ?? row.finishedAt;
  const error = patch.error ?? row.error;
  db.prepare(
    `UPDATE operations SET state = ?, message = ?, started_at = ?, finished_at = ?, error = ?, result_json = COALESCE(?, result_json) WHERE id = ?`,
  ).run(
    state,
    message ?? null,
    startedAt ?? null,
    finishedAt ?? null,
    error ?? null,
    patch.resultJson ?? null,
    id,
  );
}

export function getOperation(id: string): Operation | undefined {
  const row = db
    .prepare(
      `SELECT id, type, state, message, accepted_at, started_at, finished_at, error FROM operations WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        type: string;
        state: OperationState;
        message: string | null;
        accepted_at: string;
        started_at: string | null;
        finished_at: string | null;
        error: string | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    message: row.message ?? undefined,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    error: row.error ?? undefined,
  };
}

export function getRunningOperation(type: string): Operation | undefined {
  const row = db
    .prepare(
      `SELECT id, type, state, message, accepted_at, started_at, finished_at, error FROM operations WHERE type = ? AND state IN ('queued', 'running') ORDER BY accepted_at DESC LIMIT 1`,
    )
    .get(type) as
    | {
        id: string;
        type: string;
        state: OperationState;
        message: string | null;
        accepted_at: string;
        started_at: string | null;
        finished_at: string | null;
        error: string | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    message: row.message ?? undefined,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    error: row.error ?? undefined,
  };
}

export function getLastOperation(type: string): Operation | undefined {
  const row = db
    .prepare(
      `SELECT id, type, state, message, accepted_at, started_at, finished_at, error FROM operations WHERE type = ? ORDER BY accepted_at DESC LIMIT 1`,
    )
    .get(type) as
    | {
        id: string;
        type: string;
        state: OperationState;
        message: string | null;
        accepted_at: string;
        started_at: string | null;
        finished_at: string | null;
        error: string | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    message: row.message ?? undefined,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    error: row.error ?? undefined,
  };
}

export function saveSnapshot(key: string, json: string): void {
  db.prepare(
    `INSERT INTO snapshots (key, json, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
  ).run(key, json, new Date().toISOString());
}

export function getSnapshot(key: string): { json: string; fetchedAt: string } | undefined {
  const row = db
    .prepare(`SELECT json, fetched_at FROM snapshots WHERE key = ?`)
    .get(key) as { json: string; fetched_at: string } | undefined;
  if (!row) return undefined;
  return { json: row.json, fetchedAt: row.fetched_at };
}

export { db };
