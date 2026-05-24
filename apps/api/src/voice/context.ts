import type { Note, OpenClawProject, Reminder } from "@concierge/shared";
import { isAllowedKioskRoute, KIOSK_DESK_ROUTES } from "@concierge/shared";
import { listCompletedNotes, listNotes, countActiveNotes, countCompletedNotes } from "../notes.js";
import { listProjects } from "../openclaw/projects.js";
import {
  listCompletedReminders,
  listReminders,
  countActiveReminders,
  countCompletedReminders,
} from "../reminders.js";

const MAX_REMINDERS = 10;
const MAX_NOTES = 10;
const MAX_COMPLETED = 5;
const MAX_PROJECTS = 10;
const MAX_SUMMARY_CHARS = 500;

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function capReminders(items: Reminder[]): Reminder[] {
  return items.slice(0, MAX_REMINDERS);
}

function capNotes(items: Note[]): Note[] {
  return items.slice(0, MAX_NOTES);
}

function capProjects(items: OpenClawProject[]): OpenClawProject[] {
  return items.slice(0, MAX_PROJECTS);
}

function formatAllowedRoutes(): string {
  return [
    "/",
    KIOSK_DESK_ROUTES.work,
    "/work?tab=projects",
    "/work?tab=reminders",
    "/work?tab=notes",
    KIOSK_DESK_ROUTES.reminders,
    KIOSK_DESK_ROUTES.notes,
    "/reminders/<id>",
    "/notes/<id>",
    "/projects/<slug>",
  ].join(", ");
}

export function buildVoiceAgentMessage(userText: string): string {
  const text = userText.trim();
  const reminders = capReminders(listReminders());
  const notes = capNotes(listNotes());
  const completedReminders = listCompletedReminders().slice(0, MAX_COMPLETED);
  const completedNotes = listCompletedNotes().slice(0, MAX_COMPLETED);
  const projects = capProjects(listProjects());

  const deskSummary = {
    activeReminders: countActiveReminders(),
    activeNotes: countActiveNotes(),
    completedReminders: countCompletedReminders(),
    completedNotes: countCompletedNotes(),
  };

  const reminderLines = reminders.map(
    (r) =>
      `- #${r.id}: ${truncate(r.text, 200)}${r.dueAt ? ` (due ${r.dueAt})` : ""}${r.projectId ? ` [project:${r.projectId}]` : ""}`,
  );
  const noteLines = notes.map(
    (n) =>
      `- #${n.id}: ${truncate(n.text, 200)}${n.pinned ? " (pinned)" : ""}${n.projectId ? ` [project:${n.projectId}]` : ""}`,
  );
  const completedReminderLines = completedReminders.map(
    (r) =>
      `- #${r.id}: ${truncate(r.text, 120)} (completed ${r.dismissedAt ?? ""})`,
  );
  const completedNoteLines = completedNotes.map(
    (n) =>
      `- #${n.id}: ${truncate(n.text, 120)} (completed ${n.dismissedAt ?? ""})`,
  );
  const projectLines = projects.map((p) => {
    const summary = p.summary ? truncate(p.summary, MAX_SUMMARY_CHARS) : "";
    return `- ${p.id}: ${p.name}${summary ? ` — ${summary}` : ""}`;
  });

  return `[Kiosk voice command]
The operator spoke on the Concierge desk display. Use the concierge-display skill and Concierge API at http://127.0.0.1:3080/api.

Operator said: "${text}"

Desk summary: ${deskSummary.activeReminders} active reminders, ${deskSummary.activeNotes} active notes, ${deskSummary.completedReminders} completed reminders, ${deskSummary.completedNotes} completed notes.

Current desk state:
Reminders (${reminders.length} active):
${reminderLines.length ? reminderLines.join("\n") : "(none)"}

Notes (${notes.length} active):
${noteLines.length ? noteLines.join("\n") : "(none)"}

Recently completed reminders (${completedReminders.length} shown):
${completedReminderLines.length ? completedReminderLines.join("\n") : "(none)"}

Recently completed notes (${completedNotes.length} shown):
${completedNoteLines.length ? completedNoteLines.join("\n") : "(none)"}

Projects (${projects.length}, read-only on disk; link items via projectId slug):
${projectLines.length ? projectLines.join("\n") : "(none)"}

Instructions:
- Perform actions via HTTP (GET/PATCH/DELETE reminders and notes, GET projects, POST /api/dashboard/commands for toast and navigate).
- Use GET /api/reminders/:id or GET /api/notes/:id for full text before editing (list context is truncated).
- List completed history: GET /api/reminders?status=completed or GET /api/notes?status=completed.
- Reply in 1–2 short sentences suitable for text-to-speech.
- After create/update, POST a toast and navigate to the detail route (${KIOSK_DESK_ROUTES.reminderDetail(0).replace("/0", "/<id>")} or ${KIOSK_DESK_ROUTES.noteDetail(0).replace("/0", "/<id>")}) so the operator sees full context.
- Destructive: if user gives exact id ("dismiss reminder 4"), execute immediately. If fuzzy ("dismiss the logs reminder"), do NOT delete yet; set pendingAction and ask them to say confirm.
- Projects cannot be created on disk via API; list/summarize and link reminders/notes with projectId.
- End EVERY reply with this exact block (valid JSON between markers):

VOICE_RESULT_JSON:
{
  "spokenReply": "<what to speak>",
  "actionsTaken": ["<e.g. created_reminder>"],
  "navigateTo": null,
  "pendingAction": null
}
END_VOICE_RESULT_JSON

navigateTo must be null or one of: ${formatAllowedRoutes()} (slug: lowercase letters, numbers, hyphens).`;
}

export function buildMockVoiceReply(userText: string): string {
  const reminders = capReminders(listReminders());
  const notes = capNotes(listNotes());
  const projects = capProjects(listProjects());
  const spoken = `Got it: “${userText}”. (Mock — ${reminders.length} reminders, ${notes.length} notes, ${projects.length} projects in context.)`;
  const payload = {
    spokenReply: spoken,
    actionsTaken: ["mock"],
    navigateTo: null,
    pendingAction: null,
  };
  return `${spoken}\n\nVOICE_RESULT_JSON:\n${JSON.stringify(payload, null, 2)}\nEND_VOICE_RESULT_JSON`;
}

/** Exported for tests */
export const VOICE_CONTEXT_LIMITS = {
  MAX_REMINDERS,
  MAX_NOTES,
  MAX_COMPLETED,
  MAX_PROJECTS,
  MAX_SUMMARY_CHARS,
} as const;

export { isAllowedKioskRoute };
