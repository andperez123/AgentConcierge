import type { OperationResponse } from "@concierge/shared";
import {
  createOperation,
  recordRestart,
  updateOperation,
} from "../db.js";
import { recordDoctorRun, recordIncident } from "../incidents.js";
import {
  getOpenClawStatus,
  restartGateway,
  runDoctor,
} from "../openclaw/adapter.js";
import { invalidateGoogleAuthCache } from "../openclaw/google.js";
import { emitDashboardEvent } from "../dashboard/events.js";
import { MOCK_OPENCLAW } from "../config.js";

export function startOperation(type: string): OperationResponse {
  const op = createOperation(type);
  emitDashboardEvent("operation-updated", { operation: op });
  return {
    operationId: op.id,
    acceptedAt: op.acceptedAt,
    state: op.state,
  };
}

export async function runRestartOperation(
  operationId: string,
  force: boolean,
): Promise<void> {
  updateOperation(operationId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });
  emitDashboardEvent("operation-updated", {
    operationId,
    state: "running",
  });

  try {
    const result = await restartGateway(force);
    recordRestart(
      force ? "force" : "safe",
      result.ok ? 0 : 1,
      result.message,
    );
    if (!result.ok) {
      recordIncident("error", "restart-gateway", result.message, operationId);
    }
    updateOperation(operationId, {
      state: result.ok ? "succeeded" : "failed",
      message: result.message,
      finishedAt: new Date().toISOString(),
      error: result.ok ? undefined : result.message,
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: result.ok ? "succeeded" : "failed",
      message: result.message,
    });
    if (result.ok) {
      emitDashboardEvent("command", {
        type: "toast",
        level: "info",
        message: "Gateway restarted",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restart failed";
    recordIncident("error", "restart-gateway", message, operationId);
    updateOperation(operationId, {
      state: "failed",
      message,
      finishedAt: new Date().toISOString(),
      error: message,
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: "failed",
      message,
    });
  }
}

export async function runDoctorOperation(operationId: string): Promise<void> {
  updateOperation(operationId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });
  emitDashboardEvent("operation-updated", {
    operationId,
    state: "running",
  });

  try {
    const result = await runDoctor();
    recordDoctorRun(result.ok ? 0 : 1, result.message);
    if (!result.ok) {
      recordIncident("error", "doctor", result.message.slice(0, 500), operationId);
    }
    updateOperation(operationId, {
      state: result.ok ? "succeeded" : "failed",
      message: result.message.slice(0, 500),
      finishedAt: new Date().toISOString(),
      error: result.ok ? undefined : result.message.slice(0, 500),
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: result.ok ? "succeeded" : "failed",
      message: result.message.slice(0, 200),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Doctor failed";
    updateOperation(operationId, {
      state: "failed",
      message,
      finishedAt: new Date().toISOString(),
      error: message,
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: "failed",
      message,
    });
  }
}

const GOOGLE_REAUTH_ARG_SETS: string[][] = [
  ["gateway", "auth", "refresh", "--json"],
  ["gateway", "auth", "login", "--provider", "google", "--json"],
  ["gateway", "auth", "login", "--json"],
  ["integrations", "connect", "google", "--json"],
  ["integrations", "auth", "google", "--json"],
];

export async function runReauthOperation(operationId: string): Promise<void> {
  updateOperation(operationId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });
  emitDashboardEvent("operation-updated", {
    operationId,
    state: "running",
  });

  if (MOCK_OPENCLAW) {
    invalidateGoogleAuthCache();
    updateOperation(operationId, {
      state: "succeeded",
      message: "Mock reauth completed — Google Drive ready",
      finishedAt: new Date().toISOString(),
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: "succeeded",
      message: "Mock reauth completed",
    });
    return;
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { OPENCLAW_BIN } = await import("../config.js");
  const { openclawEnv } = await import("../openclaw/env.js");
  const execFileAsync = promisify(execFile);

  const attempts: string[] = [];
  let lastErr = "";

  for (const args of GOOGLE_REAUTH_ARG_SETS) {
    const label = args.join(" ");
    try {
      const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
        env: openclawEnv(),
      });
      const out = (stdout || stderr || "").trim();
      attempts.push(`${label}: ok`);
      invalidateGoogleAuthCache();
      await getOpenClawStatus(true);
      const message = (
        out.slice(0, 400) ||
        "Google reauth completed. Save to Drive from Work items when connected."
      ).slice(0, 500);
      updateOperation(operationId, {
        state: "succeeded",
        message,
        finishedAt: new Date().toISOString(),
      });
      emitDashboardEvent("operation-updated", {
        operationId,
        state: "succeeded",
        message,
      });
      return;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      lastErr = (e.stderr ?? e.message ?? "failed").toString().slice(0, 200);
      attempts.push(`${label}: ${lastErr}`);
    }
  }

  const message = [
    "Google reauth failed on the Pi.",
    "SSH in and run: openclaw gateway auth login",
    "or: openclaw gateway auth refresh",
    attempts.join(" · "),
  ].join(" ");

  updateOperation(operationId, {
    state: "failed",
    message: message.slice(0, 800),
    finishedAt: new Date().toISOString(),
    error: lastErr,
  });
  recordIncident("error", "reauth", message.slice(0, 500), operationId);
  emitDashboardEvent("operation-updated", {
    operationId,
    state: "failed",
    message: message.slice(0, 500),
  });
}

export async function runRefreshProbesOperation(
  operationId: string,
): Promise<void> {
  updateOperation(operationId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });
  try {
    await getOpenClawStatus(true);
    updateOperation(operationId, {
      state: "succeeded",
      message: "Probes refreshed",
      finishedAt: new Date().toISOString(),
    });
    emitDashboardEvent("state-changed", {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    updateOperation(operationId, {
      state: "failed",
      message,
      finishedAt: new Date().toISOString(),
      error: message,
    });
  }
  emitDashboardEvent("operation-updated", { operationId });
}

export async function runWorkEntityAction(
  operationId: string,
  kind: import("@concierge/shared").WorkEntityKind,
  id: string,
  body: import("@concierge/shared").WorkEntityActionBody,
): Promise<void> {
  updateOperation(operationId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });
  emitDashboardEvent("operation-updated", {
    operationId,
    state: "running",
  });

  try {
    const { executeWorkAction } = await import("../work/actions.js");
    const result = await executeWorkAction(kind, id, body);
    updateOperation(operationId, {
      state: result.ok ? "succeeded" : "failed",
      message: result.reply?.slice(0, 500) ?? result.message,
      finishedAt: new Date().toISOString(),
      error: result.ok ? undefined : result.message,
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: result.ok ? "succeeded" : "failed",
      message: result.message,
    });
    emitDashboardEvent("state-changed", {});
    if (result.ok) {
      emitDashboardEvent("command", {
        type: "toast",
        level: "info",
        message: result.reply?.slice(0, 120) ?? result.message,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    updateOperation(operationId, {
      state: "failed",
      message,
      finishedAt: new Date().toISOString(),
      error: message,
    });
    emitDashboardEvent("operation-updated", {
      operationId,
      state: "failed",
      message,
    });
  }
}
