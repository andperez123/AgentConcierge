import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  formatProjectBreakdownMarkdown,
  type ProjectBreakdown,
} from "@concierge/shared";
import {
  exportFilename,
  exportProjectContextToFile,
  writeProjectExportFile,
} from "./projectExport.js";

const FIXTURE: ProjectBreakdown = {
  project: {
    id: "revenue-factory",
    name: "Revenue Factory",
    path: "/home/pi/clawd/projects/revenue-factory",
    updatedAt: "2026-05-20T12:00:00.000Z",
    status: "active",
    nextFocus: "Ship pricing page",
  },
  sections: [
    {
      title: "Docs",
      items: [{ label: "PRD", detail: "v2 draft" }],
    },
  ],
  linkedReminders: [
    {
      id: 1,
      text: "Call design partner",
      dueAt: "2026-05-24T15:00:00.000Z",
      createdAt: "2026-05-01T00:00:00.000Z",
      projectId: "revenue-factory",
    },
  ],
  linkedNotes: [
    {
      id: 2,
      text: "ICP: solo founders",
      createdAt: "2026-05-01T00:00:00.000Z",
      projectId: "revenue-factory",
    },
  ],
  overview: {
    status: "active",
    nextFocus: "Ship pricing page",
    sections: [
      { title: "Vision", body: "B2B invoicing for LATAM." },
    ],
  },
  tasks: [
    { id: "interview-0", text: "Interview 5 founders", done: false, group: "Discovery" },
    { id: "define-icp-1", text: "Define ICP", done: true, group: "Discovery" },
    { id: "wireframe-2", text: "Wireframe onboarding", done: false, group: "Build" },
  ],
  taskProgress: { done: 1, total: 3 },
};

describe("formatProjectBreakdownMarkdown", () => {
  it("includes title, meta, overview, tasks, desk items, and docs", () => {
    const md = formatProjectBreakdownMarkdown(FIXTURE, "2026-05-24T10:00:00.000Z");
    assert.match(md, /^# Revenue Factory/m);
    assert.match(md, /\*\*Status:\*\* active/);
    assert.match(md, /\*\*Next:\*\* Ship pricing page/);
    assert.match(md, /\*\*Tasks:\*\* 1\/3/);
    assert.match(md, /## Overview/);
    assert.match(md, /### Vision/);
    assert.match(md, /## Tasks/);
    assert.match(md, /### Discovery/);
    assert.match(md, /- \[ \] Interview 5 founders/);
    assert.match(md, /- \[x\] Define ICP/);
    assert.match(md, /### Build/);
    assert.match(md, /## Desk items/);
    assert.match(md, /### Reminders/);
    assert.match(md, /Call design partner/);
    assert.match(md, /due: 2026-05-24T15:00:00.000Z/);
    assert.match(md, /### Notes/);
    assert.match(md, /ICP: solo founders/);
    assert.match(md, /## Documents & folders/);
    assert.match(md, /\*\*PRD\*\* — v2 draft/);
    assert.match(md, /Exported from Concierge · 2026-05-24T10:00:00.000Z/);
  });

  it("omits empty sections", () => {
    const minimal: ProjectBreakdown = {
      project: { id: "solo", name: "Solo" },
      sections: [],
      linkedReminders: [],
      linkedNotes: [],
      tasks: [{ id: "t-0", text: "One task", done: false }],
      taskProgress: { done: 0, total: 1 },
    };
    const md = formatProjectBreakdownMarkdown(minimal);
    assert.doesNotMatch(md, /## Overview/);
    assert.doesNotMatch(md, /## Desk items/);
    assert.doesNotMatch(md, /## Documents/);
    assert.match(md, /## Tasks/);
    assert.match(md, /- \[ \] One task/);
  });
});

describe("exportFilename", () => {
  it("sanitizes project id for filesystem", () => {
    assert.equal(exportFilename("revenue-factory"), "revenue-factory-context.md");
    assert.equal(exportFilename("Foo Bar!!"), "foo-bar-context.md");
  });
});

describe("writeProjectExportFile", () => {
  it("writes markdown to export directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "concierge-export-"));
    try {
      const result = writeProjectExportFile(FIXTURE, "revenue-factory", dir);
      assert.equal(result.ok, true);
      assert.equal(result.filename, "revenue-factory-context.md");
      const content = readFileSync(join(dir, "revenue-factory-context.md"), "utf8");
      assert.match(content, /^# Revenue Factory/);
      assert.match(content, /Exported from Concierge/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("exportProjectContextToFile", () => {
  it("returns not found for missing project", () => {
    const result = exportProjectContextToFile(
      "nonexistent-project-xyz",
      "/tmp/should-not-write",
    );
    assert.equal(result.ok, false);
    assert.equal(result.message, "Project not found");
  });
});
