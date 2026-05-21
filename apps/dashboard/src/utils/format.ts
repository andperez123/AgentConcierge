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

export type ReminderFilter = "overdue" | "today" | "upcoming" | "no-date";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  const e = startOfDay(d);
  e.setDate(e.getDate() + 1);
  return e;
}

function isTomorrow(due: Date, now: Date): boolean {
  const t = startOfDay(now);
  t.setDate(t.getDate() + 1);
  const tomorrowEnd = new Date(t);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  return due >= t && due < tomorrowEnd;
}

export function getReminderFilterCategory(dueAt?: string): ReminderFilter {
  if (!dueAt) return "no-date";
  const due = new Date(dueAt);
  const now = new Date();
  if (due < now) return "overdue";
  if (due < endOfDay(now)) return "today";
  return "upcoming";
}

export function formatReminderDue(dueAt?: string): string {
  if (!dueAt) return "No date";
  const due = new Date(dueAt);
  const now = new Date();
  if (due < now) return "Overdue";
  const time = due.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (due >= startOfDay(now) && due < endOfDay(now)) {
    return `Today ${time}`;
  }
  if (isTomorrow(due, now)) {
    return `Tomorrow ${time}`;
  }
  const day = due.toLocaleDateString([], { weekday: "short" });
  return `${day} ${time}`;
}

export function dueInOneHour(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export function dueTonight(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d <= new Date()) {
    d.setHours(20, 0, 0, 0);
    if (d <= new Date()) {
      const later = new Date();
      later.setHours(later.getHours() + 2, 0, 0, 0);
      return later.toISOString();
    }
  }
  return d.toISOString();
}

export function dueTomorrow9am(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function dueAtHour(hour: number, dayOffset: 0 | 1): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export type ReminderDueTone = "overdue" | "today" | "upcoming" | "none";

export function getReminderDueTone(dueAt?: string): ReminderDueTone {
  const cat = getReminderFilterCategory(dueAt);
  if (cat === "no-date") return "none";
  return cat;
}
