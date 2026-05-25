import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatProjectBreakdownMarkdown,
  type ProjectBreakdown,
  type ProjectExportResponse,
} from "@concierge/shared";
import { OPENCLAW_EXPORT_DIR } from "../config.js";
import { getProjectBreakdown } from "./projects.js";

export function exportFilename(projectId: string): string {
  const safe = projectId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${safe || "project"}-context.md`;
}

export function writeProjectExportFile(
  breakdown: ProjectBreakdown,
  projectId: string,
  exportDir: string,
): ProjectExportResponse {
  const filename = exportFilename(projectId);
  const path = join(exportDir, filename);
  const markdown = formatProjectBreakdownMarkdown(breakdown);

  try {
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(path, markdown, "utf8");
    return { ok: true, path, filename };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Export failed",
    };
  }
}

export function exportProjectContextToFile(
  projectId: string,
  exportDir: string = OPENCLAW_EXPORT_DIR,
): ProjectExportResponse {
  const breakdown = getProjectBreakdown(projectId);
  if (!breakdown) {
    return { ok: false, message: "Project not found" };
  }
  return writeProjectExportFile(breakdown, projectId, exportDir);
}
