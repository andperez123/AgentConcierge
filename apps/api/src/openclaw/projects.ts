import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  OpenClawProject,
  ProjectBreakdown,
  ProjectBreakdownSection,
  ProjectOverview,
  ProjectTask,
  SyncProjectBody,
} from "@concierge/shared";
import { OPENCLAW_PROJECTS_DIR } from "../config.js";
import { db } from "../db.js";
import { listReminders } from "../reminders.js";
import { listNotes } from "../notes.js";
import {
  computeTaskProgress,
  firstParagraphForSummary,
  parseOverviewMarkdown,
  parseTasksMarkdown,
} from "./projectParse.js";

const CORE_MD = new Set(["README.md", "BREAKDOWN.md", "OVERVIEW.md", "TASKS.md"]);

function slugToName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function readFileUtf8(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function readPreview(filePath: string, max = 200): string {
  const raw = readFileUtf8(filePath);
  if (!raw) return "";
  const h1 = raw.match(/^#\s+(.+)$/m);
  const body = (h1 ? raw.slice(raw.indexOf(h1[0]) + h1[0].length) : raw)
    .replace(/^#+\s+/gm, "")
    .trim();
  return body.slice(0, max).trim();
}

function readOverview(dirPath: string): ProjectOverview | undefined {
  const raw = readFileUtf8(join(dirPath, "OVERVIEW.md"));
  if (!raw) return undefined;
  return parseOverviewMarkdown(raw);
}

function readTasks(dirPath: string): ProjectTask[] {
  const raw = readFileUtf8(join(dirPath, "TASKS.md"));
  if (!raw) return [];
  return parseTasksMarkdown(raw);
}

function enrichProjectFromDir(
  base: OpenClawProject,
  dirPath: string,
): OpenClawProject {
  const overview = readOverview(dirPath);
  const tasks = readTasks(dirPath);
  const taskProgress = computeTaskProgress(tasks);

  let summary = base.summary;
  const overviewRaw = readFileUtf8(join(dirPath, "OVERVIEW.md"));
  if (overviewRaw) {
    summary = firstParagraphForSummary(overviewRaw, 280) || summary;
  }

  return {
    ...base,
    summary,
    status: overview?.status,
    nextFocus: overview?.nextFocus,
    taskProgress,
  };
}

function scanProjectDir(dirPath: string, id: string): OpenClawProject {
  let updatedAt: string | undefined;
  try {
    updatedAt = statSync(dirPath).mtime.toISOString();
  } catch {
    /* ignore */
  }

  let summary: string | undefined;
  const overviewPath = join(dirPath, "OVERVIEW.md");
  if (existsSync(overviewPath)) {
    const raw = readFileUtf8(overviewPath);
    if (raw) summary = firstParagraphForSummary(raw, 280);
  }
  if (!summary) {
    for (const name of ["README.md", "BREAKDOWN.md"]) {
      const p = join(dirPath, name);
      if (existsSync(p)) {
        summary = readPreview(p, 280);
        break;
      }
    }
  }
  if (!summary) {
    try {
      const md = readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      const breakdown = md.find((f) => /breakdown/i.test(f));
      if (breakdown) summary = readPreview(join(dirPath, breakdown), 280);
    } catch {
      /* ignore */
    }
  }

  const base: OpenClawProject = {
    id,
    name: slugToName(id),
    summary,
    updatedAt,
    path: dirPath,
  };
  return enrichProjectFromDir(base, dirPath);
}

function buildSectionsFromDir(dirPath: string): ProjectBreakdownSection[] {
  const sections: ProjectBreakdownSection[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const mdFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .filter((n) => !CORE_MD.has(n))
      .sort();

    if (mdFiles.length > 0) {
      sections.push({
        title: "Documents",
        items: mdFiles.map((name) => ({
          label: name.replace(/\.md$/i, ""),
          detail: readPreview(join(dirPath, name)),
        })),
      });
    }

    const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (subdirs.length > 0) {
      sections.push({
        title: "Folders",
        items: subdirs.map((name) => ({ label: name })),
      });
    }
  } catch {
    /* ignore */
  }
  return sections;
}

function listFromFilesystem(): OpenClawProject[] {
  if (!existsSync(OPENCLAW_PROJECTS_DIR)) return [];
  try {
    return readdirSync(OPENCLAW_PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => scanProjectDir(join(OPENCLAW_PROJECTS_DIR, e.name), e.name))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  } catch {
    return [];
  }
}

function listFromCache(): OpenClawProject[] {
  const rows = db
    .prepare(
      `SELECT id, name, summary, updated_at FROM project_cache ORDER BY updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    name: string;
    summary: string | null;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    summary: r.summary ?? undefined,
    updatedAt: r.updated_at,
    path: join(OPENCLAW_PROJECTS_DIR, r.id),
  }));
}

export function listProjects(): OpenClawProject[] {
  const fsProjects = listFromFilesystem();
  const byId = new Map<string, OpenClawProject>();
  for (const p of listFromCache()) byId.set(p.id, p);
  for (const p of fsProjects) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export function getProject(id: string): OpenClawProject | null {
  const dirPath = join(OPENCLAW_PROJECTS_DIR, id);
  if (existsSync(dirPath)) return scanProjectDir(dirPath, id);
  const row = db
    .prepare(
      `SELECT id, name, summary, updated_at FROM project_cache WHERE id = ?`,
    )
    .get(id) as
    | { id: string; name: string; summary: string | null; updated_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    summary: row.summary ?? undefined,
    updatedAt: row.updated_at,
    path: join(OPENCLAW_PROJECTS_DIR, row.id),
  };
}

export function getProjectBreakdown(id: string): ProjectBreakdown | null {
  const project = getProject(id);
  if (!project) return null;

  const dirPath = join(OPENCLAW_PROJECTS_DIR, id);
  let sections: ProjectBreakdownSection[] = [];
  let overview: ProjectOverview | undefined;
  let tasks: ProjectTask[] = [];
  let taskProgress = project.taskProgress;

  if (existsSync(dirPath)) {
    sections = buildSectionsFromDir(dirPath);
    overview = readOverview(dirPath);
    tasks = readTasks(dirPath);
    taskProgress = computeTaskProgress(tasks) ?? taskProgress;
  } else {
    const row = db
      .prepare(`SELECT breakdown_json FROM project_cache WHERE id = ?`)
      .get(id) as { breakdown_json: string | null } | undefined;
    if (row?.breakdown_json) {
      try {
        sections = JSON.parse(row.breakdown_json) as ProjectBreakdownSection[];
      } catch {
        sections = [];
      }
    }
  }

  return {
    project,
    sections,
    linkedReminders: listReminders(id),
    linkedNotes: listNotes(id),
    overview,
    tasks: tasks.length > 0 ? tasks : undefined,
    taskProgress,
  };
}

export function syncProject(body: SyncProjectBody): OpenClawProject {
  const id = body.id.trim();
  if (!id) throw new Error("Project id is required");
  const name = body.name?.trim() || slugToName(id);
  const now = new Date().toISOString();
  const breakdownJson = body.breakdown
    ? JSON.stringify(body.breakdown)
    : null;
  db.prepare(
    `INSERT INTO project_cache (id, name, summary, breakdown_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       summary = COALESCE(excluded.summary, project_cache.summary),
       breakdown_json = COALESCE(excluded.breakdown_json, project_cache.breakdown_json),
       updated_at = excluded.updated_at`,
  ).run(id, name, body.summary ?? null, breakdownJson, now);
  return getProject(id) ?? { id, name, summary: body.summary, updatedAt: now };
}
