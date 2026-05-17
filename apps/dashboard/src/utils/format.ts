import type { HealthState, SystemHealth } from "@concierge/shared";

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatLastSeen(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const FRIENDLY_STATUS: Record<HealthState, string> = {
  healthy: "Online",
  degraded: "Degraded",
  blocked: "Offline",
  action_needed: "Auth needed",
  restarting: "Restarting",
  unknown: "Unknown",
};

export function friendlyHealthLabel(state: HealthState): string {
  return FRIENDLY_STATUS[state] ?? state;
}

export function authLabel(health: SystemHealth | null): string {
  if (!health) return "—";
  const authReason = health.reasons.find((r) =>
    r.toLowerCase().includes("auth"),
  );
  if (health.state === "healthy") return "Authenticated";
  if (health.state === "action_needed" || authReason) return "Check auth";
  return "—";
}

export function formatReminderTime(dueAt?: string): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  const isToday =
    due.getDate() === now.getDate() &&
    due.getMonth() === now.getMonth() &&
    due.getFullYear() === now.getFullYear();
  if (isToday) {
    return due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return due.toLocaleDateString([], { month: "short", day: "numeric" });
}
