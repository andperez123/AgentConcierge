import type { ProjectBreakdown, ProjectTask } from "./index.js";

function metaLine(label: string, value: string | undefined): string | null {
  const v = value?.trim();
  return v ? `**${label}:** ${v}` : null;
}

function groupTasks(tasks: ProjectTask[]): Map<string | undefined, ProjectTask[]> {
  const groups = new Map<string | undefined, ProjectTask[]>();
  for (const t of tasks) {
    const list = groups.get(t.group) ?? [];
    list.push(t);
    groups.set(t.group, list);
  }
  return groups;
}

export function formatProjectBreakdownMarkdown(
  breakdown: ProjectBreakdown,
  exportedAt: string = new Date().toISOString(),
): string {
  const lines: string[] = [];
  const { project, overview, tasks, taskProgress, linkedReminders, linkedNotes, sections } =
    breakdown;

  lines.push(`# ${project.name}`);
  lines.push("");

  const meta: string[] = [];
  const status = overview?.status ?? project.status;
  const nextFocus = overview?.nextFocus ?? project.nextFocus;
  if (metaLine("Status", status)) meta.push(metaLine("Status", status)!);
  if (metaLine("Next", nextFocus)) meta.push(metaLine("Next", nextFocus)!);
  if (metaLine("Path", project.path)) meta.push(metaLine("Path", project.path)!);
  if (project.updatedAt) {
    meta.push(`**Updated:** ${project.updatedAt.slice(0, 10)}`);
  }
  if (taskProgress && taskProgress.total > 0) {
    meta.push(`**Tasks:** ${taskProgress.done}/${taskProgress.total}`);
  }
  if (meta.length > 0) {
    lines.push(...meta);
    lines.push("");
  }

  if (overview && overview.sections.length > 0) {
    lines.push("## Overview");
    lines.push("");
    for (const sec of overview.sections) {
      lines.push(`### ${sec.title}`);
      lines.push("");
      if (sec.body.trim()) {
        lines.push(sec.body.trim());
        lines.push("");
      }
    }
  }

  if (tasks && tasks.length > 0) {
    lines.push("## Tasks");
    lines.push("");
    for (const [group, items] of groupTasks(tasks)) {
      if (group) {
        lines.push(`### ${group}`);
        lines.push("");
      }
      for (const t of items ?? []) {
        lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
      }
      lines.push("");
    }
  }

  if (linkedReminders.length > 0 || linkedNotes.length > 0) {
    lines.push("## Desk items");
    lines.push("");
    if (linkedReminders.length > 0) {
      lines.push("### Reminders");
      lines.push("");
      for (const r of linkedReminders) {
        const due = r.dueAt ? ` (due: ${r.dueAt})` : "";
        lines.push(`- ${r.text}${due}`);
      }
      lines.push("");
    }
    if (linkedNotes.length > 0) {
      lines.push("### Notes");
      lines.push("");
      for (const n of linkedNotes) {
        lines.push(`- ${n.text}`);
      }
      lines.push("");
    }
  }

  if (sections.length > 0) {
    lines.push("## Documents & folders");
    lines.push("");
    for (const section of sections) {
      lines.push(`### ${section.title}`);
      lines.push("");
      for (const item of section.items) {
        if (item.detail?.trim()) {
          lines.push(`- **${item.label}** — ${item.detail.trim()}`);
        } else {
          lines.push(`- **${item.label}**`);
        }
      }
      lines.push("");
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  lines.push("");
  lines.push(`_Exported from Concierge · ${exportedAt}_`);

  return lines.join("\n");
}
