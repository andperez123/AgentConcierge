import type { Alert, AlertLevel, AlertStatus, CreateAlertBody } from "@concierge/shared";
import { db } from "./db.js";
import { randomUUID } from "node:crypto";
import { emitDashboardEvent } from "./dashboard/events.js";

function rowToAlert(row: {
  id: string;
  level: string;
  title: string;
  message: string;
  source: string | null;
  status: string;
  created_at: string;
  acked_at: string | null;
  actions_json: string | null;
}): Alert {
  return {
    id: row.id,
    level: row.level as AlertLevel,
    title: row.title,
    message: row.message,
    source: row.source ?? undefined,
    status: row.status as AlertStatus,
    createdAt: row.created_at,
    ackedAt: row.acked_at ?? undefined,
    actions: row.actions_json ? (JSON.parse(row.actions_json) as string[]) : undefined,
  };
}

export function listAlerts(activeOnly = true): Alert[] {
  const sql = activeOnly
    ? `SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 20`
    : `SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50`;
  const rows = db.prepare(sql).all() as Array<{
    id: string;
    level: string;
    title: string;
    message: string;
    source: string | null;
    status: string;
    created_at: string;
    acked_at: string | null;
    actions_json: string | null;
  }>;
  return rows.map(rowToAlert);
}

export function createAlert(body: CreateAlertBody): Alert {
  const id = body.id ?? randomUUID();
  const level = body.level ?? "info";
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO alerts (id, level, title, message, source, status, created_at, actions_json) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    id,
    level,
    body.title,
    body.message,
    body.source ?? null,
    createdAt,
    body.actions ? JSON.stringify(body.actions) : null,
  );
  const alert = rowToAlert({
    id,
    level,
    title: body.title,
    message: body.message,
    source: body.source ?? null,
    status: "active",
    created_at: createdAt,
    acked_at: null,
    actions_json: body.actions ? JSON.stringify(body.actions) : null,
  });
  emitDashboardEvent("alert-created", { alert });
  return alert;
}

export function ackAlert(id: string): boolean {
  const result = db
    .prepare(
      `UPDATE alerts SET status = 'acked', acked_at = ? WHERE id = ? AND status = 'active'`,
    )
    .run(new Date().toISOString(), id);
  if (result.changes > 0) {
    emitDashboardEvent("alert-updated", { alertId: id, status: "acked" });
    return true;
  }
  return false;
}

export function deleteAlert(id: string): boolean {
  const result = db.prepare(`DELETE FROM alerts WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function syncHealthAlert(healthSummary: string, state: string): void {
  if (state === "healthy" || state === "restarting") {
    db.prepare(
      `UPDATE alerts SET status = 'resolved' WHERE id = 'gateway-health' AND status = 'active'`,
    ).run();
    return;
  }
  const level: AlertLevel =
    state === "blocked" ? "critical" : state === "action_needed" ? "error" : "warning";
  createAlert({
    id: "gateway-health",
    level,
    title: "Gateway needs attention",
    message: healthSummary,
    source: "concierge-health",
    actions: ["restart-gateway", "view-logs"],
  });
}
