import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTaskProgress,
  firstParagraphForSummary,
  parseOverviewMarkdown,
  parseTasksMarkdown,
} from "./projectParse.js";

const SAMPLE_OVERVIEW = `# NovaPay

## Vision
B2B invoicing for solo founders in LATAM.

## Status
idea

## Next focus
Validate pricing with 5 founder interviews.

## Context
- Competitors: X, Y
`;

const SAMPLE_TASKS = `# Tasks

## Discovery
- [ ] Interview 5 founders
- [x] Define ICP

## Build
- [ ] Wireframe onboarding
`;

describe("parseOverviewMarkdown", () => {
  it("extracts status, next focus, and sections", () => {
    const o = parseOverviewMarkdown(SAMPLE_OVERVIEW);
    assert.equal(o.status, "idea");
    assert.equal(o.nextFocus, "Validate pricing with 5 founder interviews.");
    assert.equal(o.sections.length, 2);
    assert.equal(o.sections[0].title, "Vision");
    assert.match(o.sections[0].body, /LATAM/);
    assert.equal(o.sections[1].title, "Context");
  });
});

describe("parseTasksMarkdown", () => {
  it("parses checkbox items with groups", () => {
    const tasks = parseTasksMarkdown(SAMPLE_TASKS);
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].group, "Discovery");
    assert.equal(tasks[0].done, false);
    assert.equal(tasks[1].done, true);
    assert.equal(tasks[2].group, "Build");
    assert.ok(tasks.every((t) => t.id.length > 0));
  });
});

describe("computeTaskProgress", () => {
  it("returns done/total counts", () => {
    const tasks = parseTasksMarkdown(SAMPLE_TASKS);
    const p = computeTaskProgress(tasks);
    assert.deepEqual(p, { done: 1, total: 3 });
  });

  it("returns undefined for empty list", () => {
    assert.equal(computeTaskProgress([]), undefined);
  });
});

describe("firstParagraphForSummary", () => {
  it("skips headings and returns first paragraph", () => {
    const s = firstParagraphForSummary(SAMPLE_OVERVIEW);
    assert.match(s, /B2B invoicing/);
    assert.doesNotMatch(s, /^#/);
  });
});
