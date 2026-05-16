import type { OpenClawStatus, SystemHealth, HealthState } from "@concierge/shared";
import { getRunningOperation } from "../db.js";

export function mapToSystemHealth(
  status: OpenClawStatus | null,
  error?: string | null,
): SystemHealth {
  const lastCheckedAt = status?.checkedAt ?? new Date().toISOString();
  const restarting = getRunningOperation("restart-gateway");

  if (restarting) {
    return {
      state: "restarting",
      summary: "Gateway restart in progress",
      reasons: ["Restart operation running"],
      recommendedActions: [],
      lastCheckedAt,
      stale: status?.stale,
      legacyState: status?.state,
    };
  }

  if (error && !status) {
    return {
      state: "unknown",
      summary: "Unable to check gateway",
      reasons: [error],
      recommendedActions: ["refresh-probes", "view-logs"],
      operatorSteps: ["Check API service", "View gateway logs"],
      lastCheckedAt,
      stale: true,
    };
  }

  if (!status) {
    return {
      state: "unknown",
      summary: "Checking gateway…",
      reasons: [],
      recommendedActions: [],
      lastCheckedAt,
    };
  }

  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  const operatorSteps: string[] = [];
  let state: HealthState = "unknown";

  if (status.mock) {
    return {
      state: status.state === "online" ? "healthy" : "degraded",
      summary:
        status.state === "online"
          ? "Gateway reachable (mock)"
          : "Gateway degraded (mock)",
      reasons: ["Mock mode enabled"],
      recommendedActions: [],
      lastCheckedAt,
      stale: status.stale,
      legacyState: status.state,
    };
  }

  if (!status.service.running && !status.probe.reachable) {
    state = "blocked";
    reasons.push("Service not running", "Gateway unreachable");
    recommendedActions.push("restart-gateway", "view-logs");
    operatorSteps.push("Tap Restart gateway", "Check logs if restart fails");
  } else if (
    status.probe.readProbe &&
    status.probe.readProbe !== "ok" &&
    status.probe.readProbe !== "unknown"
  ) {
    state = "action_needed";
    reasons.push(`Auth probe: ${status.probe.readProbe}`);
    recommendedActions.push("reauth", "view-logs");
    operatorSteps.push("Open reauth flow", "Confirm in terminal if prompted");
  } else if (status.readyz === "not_ready" || status.eventLoopDegraded) {
    state = "degraded";
    if (status.readyz === "not_ready") reasons.push("Gateway not ready");
    if (status.eventLoopDegraded) reasons.push("Event loop degraded");
    recommendedActions.push("run-doctor", "view-logs");
  } else if (
    status.probe.reachable &&
    status.readyz === "ok" &&
    status.state === "online"
  ) {
    state = "healthy";
  } else if (status.probe.reachable) {
    state = "degraded";
    reasons.push(`State: ${status.state}`);
    recommendedActions.push("refresh-probes");
  } else {
    state = "blocked";
    reasons.push("Gateway unreachable");
    recommendedActions.push("restart-gateway", "view-logs");
  }

  const summary =
    state === "healthy"
      ? "Gateway reachable"
      : state === "degraded"
        ? "Gateway degraded"
        : state === "action_needed"
          ? "Authentication required"
          : state === "blocked"
            ? "Gateway offline or blocked"
            : "Gateway status unknown";

  return {
    state,
    summary,
    reasons,
    recommendedActions,
    operatorSteps: operatorSteps.length ? operatorSteps : undefined,
    autoRecoverable: state === "degraded",
    lastCheckedAt,
    stale: status.stale,
    legacyState: status.state,
  };
}
