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
import { listCalendarEvents } from "../calendar/store.js";

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
    KIOSK_DESK_ROUTES.calendar,
    "/reminders/<id>",
    "/notes/<id>",
    "/projects/<slug>",
  ].join(", ");
}

const MAX_CALENDAR_EVENTS = 12;

function formatCalendarTime(start: string, allDay?: boolean): string {
  if (allDay) return "all day";
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Local desk calendar stored in SQLite. */
function buildCalendarContext(): string {
  const now = new Date();
  const from = now.toISOString();
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const events = listCalendarEvents(from, to).slice(0, MAX_CALENDAR_EVENTS);

  const lines = events.map(
    (e) =>
      `- ${formatCalendarTime(e.start, e.allDay)}: ${truncate(e.title, 120)}${e.location ? ` @ ${truncate(e.location, 60)}` : ""}`,
  );

  return `Local desk calendar (SQLite):
Next 7 days (${events.length} shown):
${lines.length ? lines.join("\n") : "(none)"}`;
}

function buildAgentInstructions(channel: "voice" | "chat"): string {
  const replyStyle =
    channel === "voice"
      ? "- Reply in 1–2 short sentences suitable for text-to-speech."
      : "- Reply in clear, concise prose (a short paragraph is fine).";

  const detailRouteNote =
    channel === "voice"
      ? `- After create/update, POST a toast and navigate to the detail route (${KIOSK_DESK_ROUTES.reminderDetail(0).replace("/0", "/<id>")} or ${KIOSK_DESK_ROUTES.noteDetail(0).replace("/0", "/<id>")}) so the operator sees full context.`
      : "- After create/update, POST a toast and navigate to the detail route when helpful.";

  const spokenPlaceholder =
    channel === "voice" ? "what to speak" : "what to show the operator";

  return `Instructions:
- You control this desk display. Reflect the operator's intent on the kiosk by default — do not wait to be told to update the dashboard. After any create/update/delete, POST a toast and navigate.
- Perform actions via HTTP (GET/PATCH/DELETE reminders and notes, GET projects, POST /api/dashboard/commands for toast and navigate).
- For calendar commands, default to local SQLite events (GET/POST/DELETE /api/calendar/events). Do not mention or use Google sync unless the operator explicitly says Google.
- Use GET /api/reminders/:id or GET /api/notes/:id for full text before editing (list context is truncated).
- List completed history: GET /api/reminders?status=completed or GET /api/notes?status=completed.
${replyStyle}
${detailRouteNote}
- Destructive: if user gives exact id ("dismiss reminder 4"), execute immediately. If fuzzy ("dismiss the logs reminder"), do NOT delete yet; set pendingAction and ask them to say confirm.
- Projects cannot be created on disk via API; list/summarize and link reminders/notes with projectId.
- End EVERY reply with this exact block (valid JSON between markers):

VOICE_RESULT_JSON:
{
  "spokenReply": "<${spokenPlaceholder}>",
  "actionsTaken": ["<e.g. created_reminder>"],
  "navigateTo": null,
  "pendingAction": null
}
END_VOICE_RESULT_JSON

navigateTo must be null or one of: ${formatAllowedRoutes()} (slug: lowercase letters, numbers, hyphens).`;
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

${buildCalendarContext()}

${buildAgentInstructions("voice")}`;
}

export interface ChatTurn {
  role: "user" | "agent";
  text: string;
}

const MAX_CHAT_HISTORY = 8;

function formatChatHistory(history: ChatTurn[]): string {
  const recent = history
    .filter((t) => t.text.trim())
    .slice(-MAX_CHAT_HISTORY);
  if (!recent.length) return "(none — first message in this session)";
  return recent
    .map((t) => `${t.role === "user" ? "Operator" : "Agent"}: ${truncate(t.text, 400)}`)
    .join("\n");
}

export function buildChatAgentMessage(
  userText: string,
  history: ChatTurn[] = [],
): string {
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

  return `[Kiosk text chat]
The operator is chatting on the Concierge desk display. Use the concierge-display skill and Concierge API at http://127.0.0.1:3080/api.

Conversation so far:
${formatChatHistory(history)}

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

${buildCalendarContext()}

${buildAgentInstructions("chat")}`;
}

export function buildMockChatReply(
  userText: string,
  history: ChatTurn[] = [],
): string {
  const reminders = capReminders(listReminders());
  const notes = capNotes(listNotes());
  const projects = capProjects(listProjects());
  const historyNote =
    history.length > 0
      ? ` (${history.length} prior turn${history.length === 1 ? "" : "s"} in session)`
      : "";
  const spoken = `Got it: “${userText}”. (Mock — ${reminders.length} reminders, ${notes.length} notes, ${projects.length} projects in context${historyNote}.)`;
  const payload = {
    spokenReply: spoken,
    actionsTaken: ["mock"],
    navigateTo: null,
    pendingAction: null,
  };
  return `${spoken}\n\nVOICE_RESULT_JSON:\n${JSON.stringify(payload, null, 2)}\nEND_VOICE_RESULT_JSON`;
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
