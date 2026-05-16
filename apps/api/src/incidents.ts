import type { Incident } from "@concierge/shared";
import { db } from "./db.js";

export function recordIncident(
  severity: string,
  source: string,
  message: string,
  operationId?: string,
): Incident {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO incidents (severity, source, message, created_at, operation_id) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(severity, source, message.slice(0, 2000), createdAt, operationId ?? null);
  return {
    id: Number(result.lastInsertRowid),
    severity,
    source,
    message: message.slice(0, 2000),
    createdAt,
    operationId,
  };
}

export function listIncidents(opts?: {
  limit?: number;
  severity?: string;
}): Incident[] {
  const limit = opts?.limit ?? 5;
  let sql = `SELECT id, severity, source, message, created_at, operation_id FROM incidents`;
  const params: (string | number)[] = [];
  if (opts?.severity) {
    sql += ` WHERE severity = ?`;
    params.push(opts.severity);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    severity: string;
    source: string;
    message: string;
    created_at: string;
    operation_id: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    severity: r.severity,
    source: r.source,
    message: r.message,
    createdAt: r.created_at,
    operationId: r.operation_id ?? undefined,
  }));
}

export function recordDoctorRun(exitCode: number, summary: string): void {
  db.prepare(
    `INSERT INTO doctor_runs (at, exit_code, summary) VALUES (?, ?, ?)`,
  ).run(new Date().toISOString(), exitCode, summary.slice(0, 4000));
}

export function parseLogIncidents(lines: string[]): void {
  const errorPattern = /\b(error|fatal|panic|failed)\b/i;
  for (const line of lines.slice(-30)) {
    if (errorPattern.test(line)) {
      recordIncident("error", "gateway-log", line.slice(0, 500));
    }
  }
}
