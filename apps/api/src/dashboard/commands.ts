import type { DashboardCommand, DashboardCommandType } from "@concierge/shared";
import { db } from "../db.js";
import { randomUUID } from "node:crypto";
import { emitDashboardEvent } from "./events.js";

const ALLOWED: DashboardCommandType[] = [
  "toast",
  "navigate",
  "focus-alert",
  "confirm",
  "highlight-action",
];

export function enqueueCommand(cmd: DashboardCommand): { id: string } {
  if (!ALLOWED.includes(cmd.type)) {
    throw new Error(`Unknown command type: ${cmd.type}`);
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO dashboard_commands (id, type, payload_json, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id, cmd.type, JSON.stringify(cmd), createdAt);
  emitDashboardEvent("command", { ...cmd, commandId: id });
  db.prepare(
    `UPDATE dashboard_commands SET delivered_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), id);
  return { id };
}

export function listPendingCommands(): DashboardCommand[] {
  const rows = db
    .prepare(
      `SELECT payload_json FROM dashboard_commands WHERE delivered_at IS NULL ORDER BY created_at ASC LIMIT 10`,
    )
    .all() as Array<{ payload_json: string }>;
  return rows.map((r) => JSON.parse(r.payload_json) as DashboardCommand);
}
