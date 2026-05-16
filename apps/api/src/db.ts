import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

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

export { db };
