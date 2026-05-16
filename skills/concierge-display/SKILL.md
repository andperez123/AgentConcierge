---
name: concierge-display
description: Push reminders and notes to the Concierge desk kiosk on localhost:3080.
---

# Concierge display surface

Use this skill when the user should see something on the **physical Concierge screen** (7" kiosk), not only in chat.

Concierge API base: `http://127.0.0.1:3080/api`

## When to push

| Push to dashboard | Keep in OpenClaw memory only |
| ----------------- | ---------------------------- |
| Time-bound reminders | Long conversation history |
| "Do this today" nudges | Full documents / code context |
| Short operational alerts | Session transcripts |
| One-line desk notes | Large retrieved knowledge |

## Reminders

Create:

```bash
curl -s -X POST http://127.0.0.1:3080/api/reminders \
  -H 'Content-Type: application/json' \
  -d '{"text":"Check gateway logs","dueAt":"2026-05-16T18:00:00Z","source":"openclaw"}'
```

List active:

```bash
curl -s http://127.0.0.1:3080/api/reminders
```

Dismiss (user can also tap on screen):

```bash
curl -s -X DELETE http://127.0.0.1:3080/api/reminders/1
```

Fields:

- `text` (required) — short line for the kiosk
- `dueAt` (optional) — ISO 8601; overdue items show in amber
- `source` (optional) — default `openclaw`

## Notes

Create:

```bash
curl -s -X POST http://127.0.0.1:3080/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"text":"API key rotation due Friday","pinned":true,"source":"openclaw"}'
```

List:

```bash
curl -s http://127.0.0.1:3080/api/notes
```

Dismiss:

```bash
curl -s -X DELETE http://127.0.0.1:3080/api/notes/1
```

## Health check

```bash
curl -s http://127.0.0.1:3080/api/health
```

Expect `"ok": true` and version `0.3.0` or newer.

## Notes for agents

- API is **loopback-only** on the Pi; no auth token in v1.
- Dashboard polls every ~10s; pushes appear quickly without refresh.
- Keep text **one line** when possible — the display is glanceable, not a document viewer.
