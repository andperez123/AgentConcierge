---
name: concierge-display
description: Control the Concierge desk kiosk on localhost:3080 — reminders, notes, alerts, dashboard commands.
---

# Concierge display surface

Use this skill when the user should see something on the **physical Concierge screen** (7" kiosk at 1024×600), not only in chat.

Concierge API base: `http://127.0.0.1:3080/api`

## When to use what

| Use case | API |
| -------- | --- |
| "Do this today" / time-bound nudges | `POST /api/reminders` |
| Short desk notes | `POST /api/notes` |
| Gateway down, auth expired, ops failures | `POST /api/alerts` |
| Toast, navigate screen, focus incident | `POST /api/dashboard/commands` |
| Center hero quote / motivational card | `POST /api/display/hero` |
| Voice / spoken command to the agent | `POST /api/voice/command` |
| Full desk snapshot | `GET /api/dashboard/state` |
| List OpenClaw projects (`~/clawd/projects/`) | `GET /api/projects` |
| Project breakdown | `GET /api/projects/:id` |
| Agent action on reminder/note/project | `POST /api/work/:kind/:id/actions` |
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
- `navigateTo`: null or one of `/`, `/work`, `/work?tab=projects`, `/work?tab=reminders`, `/work?tab=notes`, `/reminders`, `/reminders/<id>`, `/notes`, `/notes/<id>`, `/projects/<slug>` (slug: `a-z0-9-`).
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

# Optional cache when folder not on disk yet
curl -s -X POST http://127.0.0.1:3080/api/projects/sync \
  -H 'Content-Type: application/json' \
  -d '{"id":"revenue-factory","name":"Revenue Factory","summary":"…"}'
```

Voice: `navigateTo: "/projects/novapay"` after summarizing; `GET /api/dashboard/state` includes `widgets.projects` for the home card.

When the operator starts a **new startup/idea project**, ask for: slug, display name, vision, status, task breakdown, and next focus — then write `OVERVIEW.md` + `TASKS.md` and link time-bound work via `POST /api/reminders` with `projectId`.

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
