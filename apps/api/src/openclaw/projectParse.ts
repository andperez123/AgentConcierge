import type {
  ProjectOverview,
  ProjectTask,
  ProjectTaskProgress,
} from "@concierge/shared";

const RESERVED_OVERVIEW_SECTIONS = new Set([
  "status",
  "next focus",
  "nextfocus",
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Parse ## sections from OVERVIEW.md */
export function parseOverviewMarkdown(raw: string): ProjectOverview {
  const sections: ProjectOverview["sections"] = [];
  let status: string | undefined;
  let nextFocus: string | undefined;

  const parts = raw.split(/^##\s+/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
    if (!title) continue;

    const key = title.toLowerCase();
    if (key === "status") {
      status = body.split("\n")[0]?.trim() || undefined;
      continue;
    }
    if (key === "next focus") {
      nextFocus = body.replace(/\n+/g, " ").trim() || undefined;
      continue;
    }
    if (RESERVED_OVERVIEW_SECTIONS.has(key)) continue;

    sections.push({ title, body });
  }

  return { status, sections, nextFocus };
}

/** Parse checkbox tasks from TASKS.md */
export function parseTasksMarkdown(raw: string): ProjectTask[] {
  const tasks: ProjectTask[] = [];
  let group: string | undefined;
  let index = 0;

  for (const line of raw.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      group = heading[1].trim();
      continue;
    }
    const item = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (!item) continue;
    const text = item[2].trim();
    if (!text) continue;
    const done = item[1].toLowerCase() === "x";
    const base = slugify(text) || "task";
    tasks.push({
      id: `${base}-${index}`,
      text,
      done,
      group,
    });
    index += 1;
  }

  return tasks;
}

export function computeTaskProgress(
  tasks: ProjectTask[],
): ProjectTaskProgress | undefined {
  if (tasks.length === 0) return undefined;
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length };
}

/** First non-heading paragraph for list summary */
export function firstParagraphForSummary(raw: string, max = 280): string {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const para = lines.join(" ").trim();
  return para.slice(0, max).trim();
}
