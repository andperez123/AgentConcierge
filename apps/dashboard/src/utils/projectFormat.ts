import type { DashboardProjectWidget, OpenClawProject } from "@concierge/shared";

export function formatProjectMeta(
  p: OpenClawProject | DashboardProjectWidget,
): string {
  const parts: string[] = [];
  if (p.status) parts.push(p.status);
  if (p.taskProgress && p.taskProgress.total > 0) {
    parts.push(`${p.taskProgress.done}/${p.taskProgress.total} tasks`);
  } else if (p.nextFocus) {
    parts.push(p.nextFocus);
  } else if ("summary" in p && p.summary) {
    parts.push(p.summary);
  }
  if ("updatedAt" in p && p.updatedAt) {
    parts.push(p.updatedAt.slice(0, 10));
  }
  return parts.join(" · ");
}
