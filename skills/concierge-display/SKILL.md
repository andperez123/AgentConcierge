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

Do **not** use reminders for critical failures — use **alerts** instead.

## Dashboard state (preferred read)

```bash
curl -s http://127.0.0.1:3080/api/dashboard/state
```

Returns `openclaw` health (`healthy`, `degraded`, `blocked`, `action_needed`, …), `alerts`, `actions`, `widgets` (weather, hero, reminders, notes).

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

Requires Chromium microphone permission on the kiosk. Replies can be read aloud in the UI (speech synthesis).

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
curl -s -X POST http://127.0.0.1:3080/api/reminders \
  -H 'Content-Type: application/json' \
  -d '{"text":"Check gateway logs","dueAt":"2026-05-16T18:00:00Z","source":"openclaw"}'
```

## Notes

```bash
curl -s -X POST http://127.0.0.1:3080/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"text":"API key rotation due Friday","pinned":true,"source":"openclaw"}'
```

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
