import type { WorkEntityActionBody, WorkEntityKind } from "@concierge/shared";
import { getProject, getProjectBreakdown } from "../openclaw/projects.js";
import { getReminder } from "../reminders.js";
import { getNote } from "../notes.js";
import { dismissReminder } from "../reminders.js";
import { dismissNote } from "../notes.js";
import { createNote } from "../notes.js";
import { sendAgentMessage } from "../openclaw/adapter.js";
import {
  startOperation,
  runWorkEntityAction,
} from "../operations/runner.js";

export function queueWorkEntityAction(
  kind: WorkEntityKind,
  id: string,
  body: WorkEntityActionBody,
) {
  const op = startOperation(`work-${body.action}`);
  void runWorkEntityAction(op.operationId, kind, id, body);
  return op;
}

export function buildEntityContext(
  kind: WorkEntityKind,
  id: string,
): { prompt: string; entity: Record<string, unknown> } | null {
  if (kind === "reminder") {
    const numId = Number(id);
    if (!Number.isFinite(numId)) return null;
    const r = getReminder(numId);
    if (!r) return null;
    return {
      prompt: `Reminder #${r.id}: ${r.text}`,
      entity: { kind, ...r },
    };
  }
  if (kind === "note") {
    const numId = Number(id);
    if (!Number.isFinite(numId)) return null;
    const n = getNote(numId);
    if (!n) return null;
    return {
      prompt: `Note #${n.id}: ${n.text}`,
      entity: { kind, ...n },
    };
  }
  if (kind === "project") {
    const breakdown = getProjectBreakdown(id);
    const project = getProject(id);
    if (!project) return null;
    return {
      prompt: `Project "${project.name}" (${project.id})`,
      entity: {
        kind,
        project,
        sections: breakdown?.sections ?? [],
        linkedReminders: breakdown?.linkedReminders ?? [],
        linkedNotes: breakdown?.linkedNotes ?? [],
      },
    };
  }
  return null;
}

export async function executeWorkAction(
  kind: WorkEntityKind,
  id: string,
  body: WorkEntityActionBody,
): Promise<{ ok: boolean; message: string; reply?: string }> {
  const ctx = buildEntityContext(kind, id);
  if (!ctx) {
    return { ok: false, message: "Entity not found" };
  }

  if (body.action === "complete") {
    if (kind === "reminder") {
      const ok = dismissReminder(Number(id));
      return ok
        ? { ok: true, message: "Reminder completed" }
        : { ok: false, message: "Reminder not found" };
    }
    if (kind === "note") {
      const ok = dismissNote(Number(id));
      return ok
        ? { ok: true, message: "Note removed" }
        : { ok: false, message: "Note not found" };
    }
    return { ok: false, message: "Cannot complete a project" };
  }

  const contextJson = JSON.stringify(ctx.entity, null, 2);
  let instruction: string;

  switch (body.action) {
    case "export-drive":
      instruction = `Export the following Concierge desk entity to Google Drive using your connected Google account. Create or update an appropriate document. Reply with a short confirmation and any Drive link if available.\n\nEntity:\n${contextJson}`;
      break;
    case "summarize":
      instruction = `Summarize the following Concierge desk entity in 2-4 sentences for a kiosk display.\n\nEntity:\n${contextJson}`;
      break;
    case "ask-agent":
      instruction =
        body.options?.prompt?.trim() ||
        `The operator selected this desk item. Help with: ${ctx.prompt}\n\nEntity:\n${contextJson}`;
      break;
    default:
      return { ok: false, message: "Unknown action" };
  }

  const result = await sendAgentMessage(instruction);
  if (body.action === "summarize" && result.ok && result.reply) {
    createNote({
      text: result.reply.slice(0, 500),
      source: `summary:${kind}:${id}`,
      pinned: false,
    });
  }
  return {
    ok: result.ok,
    message: result.ok ? "Agent finished" : "Agent failed",
    reply: result.reply,
  };
}
