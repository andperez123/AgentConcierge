---
name: concierge-display
description: Control the Concierge desk kiosk on localhost:3080 — reminders, notes, alerts, dashboard commands.
---

# Concierge display surface

You **own** the Concierge desk kiosk (7" display at 1024×600). Any operator intent that creates or changes a task, note, calendar event, or status **must** be reflected on the kiosk by default. The operator never has to say "edit the dashboard" — that is your default job.

Concierge API base: `http://127.0.0.1:3080/api`

## Default behavior

After every mutation, follow this checklist:

1. Perform the data change via HTTP (reminders, notes, calendar events, alerts, hero, etc.).
2. Always `POST /api/dashboard/commands` with a **toast** so the operator sees feedback.
3. **Navigate** to the relevant screen when helpful (`/calendar`, `/reminders/<id>`, etc.).
4. End voice/chat replies with the **Voice result block** (see below).

Never only reply in chat when the kiosk should show the outcome.

## When to use what

| Use case | API |
| -------- | --- |
| "Do this today" / time-bound nudges | `POST /api/reminders` |
| Short desk notes | `POST /api/notes` |
| Gateway down, auth expired, ops failures | `POST /api/alerts` |
| Toast, navigate screen, focus incident | `POST /api/dashboard/commands` |
| Center hero quote / motivational card | `POST /api/display/hero` |
| Voice / spoken command to the agent | `POST /api/voice/command` |
| Desk text chat (kiosk UI) | `POST /api/agent/chat` |
| Full desk snapshot | `GET /api/dashboard/state` |
| List OpenClaw projects (`~/clawd/projects/`) | `GET /api/projects` |
| Project breakdown | `GET /api/projects/:id` |
| Export project context to disk (Markdown) | `POST /api/projects/:id/export` → `~/clawd/exports/<id>-context.md` |
| Agent action on reminder/note/project | `POST /api/work/:kind/:id/actions` |
| Read the desk calendar | `GET /api/calendar/events?from=&to=` |
| Add a desk calendar event | `POST /api/calendar/events` (single event body) |
| Rare admin-only sync | `POST /api/calendar/sync` then push via bulk `POST /api/calendar/events` |
| Google auth status (display) | `GET /api/openclaw/google/status` |
| Google reauth (Pi / Drive) | `POST /api/openclaw/google/reauth` |

Do **not** use reminders for critical failures — use **alerts** instead.

## Dashboard state (preferred read)

```bash
curl -s http://127.0.0.1:3080/api/dashboard/state
```

Returns `openclaw` health (`healthy`, `degraded`, `blocked`, `action_needed`, …), `alerts`, `actions`, `widgets` (weather, hero, reminders, notes, `deskSummary` counts).

## Hero card (center panel)

```bash
curl -s -X POST http://127.0.0.1:3080/api/display/hero \
  -H 'Content-Type: application/json' \
  -d '{"quote":"Ship the auth fix today.","subtitle":"Gateway is waiting","source":"openclaw"}'
```

Optional `imageUrl` for a custom background. Updates appear on the kiosk via SSE (`state-changed`).

## Voice command (kiosk mic)

The dashboard **Voice** screen uses browser speech-to-text, then:

```bash
curl -s -X POST http://127.0.0.1:3080/api/voice/command \
  -H 'Content-Type: application/json' \
  -d '{"text":"What is the gateway status?"}'
```

On the Pi this runs `openclaw agent --message "…" --json`. Optional env: `OPENCLAW_VOICE_AGENT=<agent-id>` to target a specific agent.

Requires Chromium microphone permission on the kiosk (allow once in Chromium site settings for the Concierge URL; use `http://localhost` or HTTPS, not LAN IP over HTTP). Replies can be read aloud in the UI (speech synthesis). Voice mode loops: listen → send → TTS → listen again.

The API enriches each voice turn with current reminders, notes, and projects. You must perform desk mutations via HTTP and end every reply with the result block below.

## Desk text chat (kiosk)

The dashboard **Agent chat** screen (`/task/chat`) sends typed messages with in-session history:

```bash
curl -s -X POST http://127.0.0.1:3080/api/agent/chat \
  -H 'Content-Type: application/json' \
  -d '{"text":"Add reminder: ship auth fix","history":[{"role":"user","text":"What is on my desk?"}]}'
```

Optional env: `OPENCLAW_CHAT_AGENT=<agent-id>` (falls back to `OPENCLAW_VOICE_AGENT`).

Use the same **Voice result block** at the end of chat replies when the operator should see navigation or pending confirmations on the kiosk.

## Telegram (operator phone — preferred for remote chat)

**Do not** add a Telegram bot inside Concierge. The OpenClaw **gateway** owns Telegram on the Pi: full conversation history, pairing, and replies in the Telegram app.

1. Configure `channels.telegram` in OpenClaw (or `TELEGRAM_BOT_TOKEN`) — see https://docs.openclaw.ai/channels/telegram
2. Restart gateway; message the bot; `openclaw pairing approve telegram <CODE>`
3. Ensure this agent has the `concierge-display` skill so Telegram messages can drive the kiosk via `http://127.0.0.1:3080/api`

When the operator messages from Telegram, treat it like remote desk control: update reminders/notes, push toasts, navigate the kiosk when appropriate.

### Voice result block (mandatory)

End every voice reply with this exact format (valid JSON between markers):

```
VOICE_RESULT_JSON:
{
  "spokenReply": "Added the reminder.",
  "actionsTaken": ["created_reminder"],
  "navigateTo": "/work",
  "pendingAction": null
}
END_VOICE_RESULT_JSON
```

- `spokenReply`: short text for TTS (required).
- `actionsTaken`: e.g. `created_reminder`, `dismissed_note`, `updated_note`, `opened_reminder`, `completed_reminder`, `listed_completed`, `listed_projects`.
- `navigateTo`: null or one of `/`, `/work`, `/work?tab=projects`, `/work?tab=reminders`, `/work?tab=notes`, `/reminders`, `/reminders/<id>`, `/notes`, `/notes/<id>`, `/projects/<slug>` (slug: `a-z0-9-`), `/calendar`, `/calendar?month=YYYY-MM`.
- `pendingAction`: set when awaiting confirm for fuzzy dismiss, e.g. `{ "kind": "dismiss_reminder", "id": 4 }`.

### Voice command playbook

| User says | Agent should |
| --------- | -------------- |
| "Remind me to …" | `POST /api/reminders` + toast; `navigateTo: "/reminders/<id>"` |
| "Note: …" | `POST /api/notes` + toast; `navigateTo: "/notes/<id>"` |
| "Open reminder 4" / "Show note 3" | `navigateTo: "/reminders/4"` or `"/notes/3"` + toast |
| "Dismiss reminder 4" (exact id) | `DELETE /api/reminders/4` immediately |
| "Dismiss the logs reminder" (fuzzy) | Do **not** delete; set `pendingAction`, ask user to say confirm |
| "Delete note 3" / "Mark note 2 done" | `DELETE /api/notes/3` (soft dismiss — kept in history) |
| "What did I complete?" | `GET /api/reminders?status=completed` and/or `GET /api/notes?status=completed`, summarize |
| "Update reminder 4 to …" | `GET /api/reminders/4` then `PATCH` + `navigateTo: "/reminders/4"` |
| "Edit note 3: …" | `PATCH /api/notes/3` + `navigateTo: "/notes/3"` |
| "Add calendar event …" / "Schedule …" | `POST /api/calendar/events` + toast; `navigateTo: "/calendar"` |
| "What's on my calendar?" | `GET /api/calendar/events`, summarize upcoming |
| "Sync Google calendar" (admin only) | `POST /api/calendar/sync`, then push events back — only when operator explicitly says Google |
| "List projects" | `GET /api/projects`, summarize in `spokenReply` |
| "Add reminder for revenue-factory: …" | `POST /api/reminders` with `projectId: "revenue-factory"` |

After mutations, `POST /api/dashboard/commands` toast (and navigate if helpful). Never only reply in chat.

### Local control phrases (UI-handled)

The kiosk handles these without calling you: "stop listening", "cancel", "go back", "open work", "show projects". When user says "confirm" after a pending dismiss, they are confirming the action in `pendingAction`.

## Alerts

```bash
curl -s -X POST http://127.0.0.1:3080/api/alerts \
  -H 'Content-Type: application/json' \
  -d '{"title":"Auth expired","message":"Reauth required","level":"error","source":"openclaw","actions":["reauth","view-logs"]}'
```

Ack (user can also tap on screen):

```bash
curl -s -X POST http://127.0.0.1:3080/api/alerts/gateway-health/ack
```

## UI commands (SSE → kiosk)

```bash
curl -s -X POST http://127.0.0.1:3080/api/dashboard/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"toast","level":"info","message":"Gateway restarted"}'

curl -s -X POST http://127.0.0.1:3080/api/dashboard/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"navigate","route":"/logs"}'
```

Types: `toast`, `navigate`, `focus-alert`, `confirm`, `highlight-action`.

## Reminders

```bash
curl -s http://127.0.0.1:3080/api/reminders
curl -s http://127.0.0.1:3080/api/reminders?status=completed
curl -s http://127.0.0.1:3080/api/reminders/12

curl -s -X POST http://127.0.0.1:3080/api/reminders \
  -H 'Content-Type: application/json' \
  -d '{"text":"Check gateway logs","dueAt":"2026-05-16T18:00:00Z","source":"openclaw","projectId":"revenue-factory"}'

curl -s -X PATCH http://127.0.0.1:3080/api/reminders/12 \
  -H 'Content-Type: application/json' \
  -d '{"text":"Updated text","dueAt":null}'

# Show on kiosk after create/edit
curl -s -X POST http://127.0.0.1:3080/api/dashboard/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"navigate","route":"/reminders/12"}'
```

## Notes

```bash
curl -s http://127.0.0.1:3080/api/notes
curl -s http://127.0.0.1:3080/api/notes?status=completed
curl -s http://127.0.0.1:3080/api/notes/3

curl -s -X POST http://127.0.0.1:3080/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"text":"API key rotation due Friday","pinned":true,"source":"openclaw"}'

curl -s -X PATCH http://127.0.0.1:3080/api/notes/3 \
  -H 'Content-Type: application/json' \
  -d '{"pinned":true}'

curl -s -X POST http://127.0.0.1:3080/api/dashboard/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"navigate","route":"/notes/3"}'
```

## Projects

Projects live under `~/clawd/projects/<slug>/` on the Pi. The kiosk **home screen** shows up to four projects; tap through to `/projects/<slug>` for overview and tasks.

**Do not create project folders via API** — create the directory on disk and maintain these files:

| File | Purpose |
| ---- | ------- |
| `OVERVIEW.md` | Vision, status, next focus, context (`##` sections) |
| `TASKS.md` | Checkbox tasks (`- [ ]` / `- [x]`), optional `##` phase headings |
| `README.md` | Optional one-liner (fallback summary) |

Example `OVERVIEW.md`:

```markdown
# NovaPay

## Vision
B2B invoicing for solo founders in LATAM.

## Status
idea

## Next focus
Validate pricing with 5 founder interviews.
```

Example `TASKS.md`:

```markdown
# Tasks

## Discovery
- [ ] Interview 5 founders
- [x] Define ICP
```

```bash
curl -s http://127.0.0.1:3080/api/projects
curl -s http://127.0.0.1:3080/api/projects/revenue-factory

# Export full context to ~/clawd/exports/ (sync folder to Mac via Drive/rsync)
curl -s -X POST http://127.0.0.1:3080/api/projects/revenue-factory/export

# Optional cache when folder not on disk yet
curl -s -X POST http://127.0.0.1:3080/api/projects/sync \
  -H 'Content-Type: application/json' \
  -d '{"id":"revenue-factory","name":"Revenue Factory","summary":"…"}'
```

Voice: `navigateTo: "/projects/novapay"` after summarizing; `GET /api/dashboard/state` includes `widgets.projects` for the home card.

When the operator starts a **new startup/idea project**, ask for: slug, display name, vision, status, task breakdown, and next focus — then write `OVERVIEW.md` + `TASKS.md` and link time-bound work via `POST /api/reminders` with `projectId`.

## Calendar (local-first desk calendar)

The kiosk **Calendar** screen (`/calendar`) is a **local-first desk calendar** stored in Concierge SQLite. It renders, creates, deletes, and refreshes events **without Google auth**. You fully control it via API and voice — add, read, and delete events on the operator's behalf.

There is **no PATCH** for calendar events. To change an event: `DELETE /api/calendar/events/:id` then create a new one.

### Desk events (default path)

```bash
# Read events (ISO bounds optional)
curl -s "http://127.0.0.1:3080/api/calendar/events?from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z"

# Add one desk event
curl -s -X POST http://127.0.0.1:3080/api/calendar/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"Dentist","start":"2026-06-16T14:00:00Z","end":"2026-06-16T15:00:00Z","source":"openclaw"}'

# All-day event (use YYYY-MM-DD + allDay)
curl -s -X POST http://127.0.0.1:3080/api/calendar/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"Birthday","start":"2026-06-20","allDay":true}'

curl -s -X DELETE http://127.0.0.1:3080/api/calendar/events/<id>

curl -s -X POST http://127.0.0.1:3080/api/dashboard/commands \
  -H 'Content-Type: application/json' \
  -d '{"type":"navigate","route":"/calendar"}'
```

After create/delete, POST a toast and navigate to `/calendar` (or `/calendar?month=YYYY-MM`).

### Rare admin-only sync

Do **not** mention or use Google sync unless the operator explicitly says Google. This is an admin-only path, not a normal calendar workflow.

1. Operator explicitly asks to sync Google Calendar (or you are performing a rare admin import).
2. Call `POST /api/calendar/sync`, then list Google Calendar events for the window using your connected Google account.
3. POST them back with `replaceRange` so stale Google events are cleared.

```bash
curl -s -X POST http://127.0.0.1:3080/api/calendar/sync \
  -H 'Content-Type: application/json' \
  -d '{"month":"2026-06"}'

curl -s -X POST http://127.0.0.1:3080/api/calendar/events \
  -H 'Content-Type: application/json' \
  -d '{
    "replaceRange": { "start": "2026-06-01T00:00:00Z", "end": "2026-07-01T00:00:00Z" },
    "events": [
      {
        "googleId": "abc123",
        "calendarId": "primary",
        "title": "Team standup",
        "start": "2026-06-16T09:30:00Z",
        "end": "2026-06-16T10:00:00Z",
        "allDay": false,
        "status": "confirmed"
      }
    ]
  }'
```

Poll sync: `GET /api/operations/:id`

Field notes:

- `start`/`end`: ISO datetimes for timed events; `YYYY-MM-DD` for `allDay: true`.
- Desk events use `source: "dashboard"` or `"openclaw"` / `"agent"`. Google sync sets `source: "google"`.
- `googleId` + `replaceRange` only needed for Google bulk sync.

## Work entity actions (agent + Drive via OpenClaw)

Concierge does **not** call Google APIs directly. Actions queue `openclaw agent` with entity context.

```bash
curl -s -X POST http://127.0.0.1:3080/api/work/reminder/12/actions \
  -H 'Content-Type: application/json' \
  -d '{"action":"export-drive"}'

# Actions: ask-agent, export-drive, summarize, complete
# Kinds: reminder, note, project
```

Poll: `GET /api/operations/:id`

## Actions (async, returns operationId)

```bash
curl -s -X POST http://127.0.0.1:3080/api/openclaw/restart
curl -s -X POST http://127.0.0.1:3080/api/openclaw/doctor
curl -s -X POST http://127.0.0.1:3080/api/openclaw/reauth
```

Poll: `GET /api/operations/:id`

## Health check

```bash
curl -s http://127.0.0.1:3080/api/health
```

Expect `"ok": true` and version `0.4.0` or newer.

## Notes for agents

- API is **loopback-only** on the Pi; no auth token in v1.
- Kiosk uses SSE (`GET /api/dashboard/events`) with polling fallback.
- Keep text **one line** when possible — the display is glanceable.
