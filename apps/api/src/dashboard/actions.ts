import type { DashboardAction, DashboardActionState } from "@concierge/shared";
import { getLastOperation, getRunningOperation } from "../db.js";

export const ACTION_REGISTRY: Array<{
  id: string;
  label: string;
  description: string;
  permission: DashboardAction["permission"];
  destructive?: boolean;
}> = [
  {
    id: "restart-gateway",
    label: "Restart gateway",
    description: "Safe restart of the OpenClaw gateway",
    permission: "require-confirmation",
    destructive: false,
  },
  {
    id: "run-doctor",
    label: "Run doctor",
    description: "Run openclaw doctor diagnostics",
    permission: "auto",
  },
  {
    id: "reauth",
    label: "Reauthenticate",
    description: "Refresh gateway authentication",
    permission: "require-confirmation",
  },
  {
    id: "refresh-probes",
    label: "Refresh status",
    description: "Force a fresh health probe",
    permission: "auto",
  },
  {
    id: "view-logs",
    label: "View logs",
    description: "Open gateway log viewer",
    permission: "auto",
  },
];

function opToActionState(opType: string): DashboardActionState {
  const running = getRunningOperation(opType);
  if (running) {
    return running.state === "queued" ? "queued" : "running";
  }
  const last = getLastOperation(opType);
  if (!last) return "idle";
  if (last.state === "succeeded") return "succeeded";
  if (last.state === "failed" || last.state === "timed_out") return "failed";
  return "idle";
}

export function buildDashboardActions(
  healthState: string,
): DashboardAction[] {
  return ACTION_REGISTRY.map((def) => {
    const opType =
      def.id === "view-logs" || def.id === "refresh-probes"
        ? def.id
        : def.id;
    const last = getLastOperation(opType);
    const state = opToActionState(opType);
    const blocked =
      healthState === "restarting" &&
      (def.id === "restart-gateway" || def.id === "reauth");

    return {
      id: def.id,
      label: def.label,
      description: def.description,
      permission: def.permission,
      destructive: def.destructive,
      enabled: !blocked,
      state: blocked ? "blocked" : state,
      lastRunAt: last?.finishedAt ?? last?.acceptedAt,
      lastResult: last?.message,
    };
  });
}
