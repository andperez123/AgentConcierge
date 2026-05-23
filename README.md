# Concierge

Touchscreen dashboard for OpenClaw on Raspberry Pi 4.

## How it connects to OpenClaw

Concierge does **not** use mock data on the Pi. On the Pi it runs **on the same machine** as your OpenClaw gateway and calls the real CLI:

- `openclaw gateway status --json --deep`
- `openclaw gateway restart --safe`
- HTTP checks to `http://127.0.0.1:18789/healthz` and `/readyz`

There is no separate “connect to OpenClaw” URL to configure. If `openclaw gateway status` works in SSH on the Pi, Concierge can read that gateway.

**Mock mode** (`MOCK_OPENCLAW=1`) is only for developing the UI on a Mac **without** the `openclaw` command installed. It is disabled automatically when `NODE_ENV=production` (Pi install). You will see an orange **MOCK** badge on the status card only in mock mode.

On the Pi, `deploy/systemd/concierge-api.service` sets `MOCK_OPENCLAW=0`.

## Dashboard features

- **1024×600-native** operator home: system state, attention queue, action strip, utilities
- Severity-based gateway health (`healthy`, `degraded`, `blocked`, `action_needed`, …)
- Weather via [Open-Meteo](https://open-meteo.com/) — set your city in **Settings**
- Structured **alerts** + reminders/notes for OpenClaw
- `GET /api/dashboard/state` — single snapshot for agents
- SSE push (`GET /api/dashboard/events`) + `POST /api/dashboard/commands`
- Device metrics (CPU temp, memory, disk) on Pi
- Debug screen: **5 taps on clock** → `/debug`

**First run:** open the dashboard → tap the gear → enter your city → Save.

### Voice command (kiosk mic)

- Bottom nav **mic** → `/task/voice` — browser speech-to-text, then `POST /api/voice/command` → `openclaw agent`.
- Enable **Voice mode** for hands-free: speak → auto-send → TTS reply → listen again.
- Mic needs a **secure context** (`localhost` or HTTPS). On Mac dev, use http://localhost:5173 (not LAN IP over HTTP).
- Optional: `OPENCLAW_VOICE_AGENT=<id>` in `.env` for a dedicated agent with the `concierge-display` skill.
- Chromium on the Pi must allow microphone access for the kiosk profile once.

## Develop on Mac

```bash
cd /Volumes/AHARDRIVE/Projects/Concierge
cp .env.example .env   # MOCK_OPENCLAW=0 by default

npm install
npm run build

# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:dashboard
```

Open http://localhost:5173 (dashboard proxies API).

If you do not have OpenClaw on your Mac and only want to preview the UI:

```bash
MOCK_OPENCLAW=1 npm run dev:api
```

## Deploy on Raspberry Pi

### Prerequisites on the Pi

- Raspberry Pi OS with desktop (for kiosk) or lite + manual browser
- Node.js 20+ (`node -v`)
- OpenClaw installed and gateway running: `openclaw gateway status`
- Build tools for native modules: `sudo apt install -y build-essential python3`

### 1. Get the project onto the Pi

#### Option A — GitHub (recommended if SSH/rsync fails)

**On your Mac** — push the repo once:

```bash
cd /Volumes/AHARDRIVE/Projects/Concierge
git init
git add .
git commit -m "Initial Concierge MVP"
# Repo: git@github.com:andperez123/AgentConcierge.git
git remote add origin git@github.com:andperez123/AgentConcierge.git
git branch -M main
git push -u origin main
```

**On the Pi** (`aperez@crawdbot`) — clone and install:

```bash
sudo apt install -y git
git clone git@github.com:andperez123/AgentConcierge.git ~/Concierge
# Or HTTPS: git clone https://github.com/andperez123/AgentConcierge.git ~/Concierge
cd ~/Concierge
chmod +x deploy/install-pi.sh deploy/kiosk/launch-kiosk.sh
./deploy/install-pi.sh
```

Updates later (on the Pi):

```bash
cd ~/Concierge
git pull
./deploy/install-pi.sh
sudo systemctl restart concierge-api
sudo systemctl restart concierge-kiosk   # if kiosk is enabled
```

**Kiosk Chromium fix:** if `chromium-browser` is not found, the install script uses `chromium` auto-detect in `deploy/kiosk/launch-kiosk.sh`.

#### Option B — rsync over SSH

From your Mac (replace IP and user):

```bash
rsync -avz --exclude node_modules /Volumes/AHARDRIVE/Projects/Concierge/ aperez@10.0.0.75:~/Concierge/
```

Requires SSH enabled on the Pi (`sudo systemctl enable --now ssh`).

### 2. Install on the Pi

```bash
ssh pi@192.168.1.XXX
cd ~/Concierge
chmod +x deploy/install-pi.sh deploy/kiosk/launch-kiosk.sh
./deploy/install-pi.sh
```

This builds the app, installs to `/opt/concierge`, and starts `concierge-api`.

### 3. Verify API + real OpenClaw status

On the Pi:

```bash
curl http://127.0.0.1:3080/api/health
# should show "mock": false, version 0.4.0+

openclaw gateway status
curl http://127.0.0.1:3080/api/openclaw/status
curl http://127.0.0.1:3080/api/dashboard/state
# should match gateway status; no "mock": true in JSON
```

OpenClaw can push desk alerts and read full state:

```bash
curl -s -X POST http://127.0.0.1:3080/api/alerts \
  -H 'Content-Type: application/json' \
  -d '{"title":"Check logs","message":"Gateway noisy","source":"openclaw"}'
```

See [`skills/concierge-display/SKILL.md`](skills/concierge-display/SKILL.md).

If `/api/health` shows `"mock": true`, the API was started with mock enabled — fix with:

```bash
sudo systemctl restart concierge-api
```

In a browser on the Pi (or another device on your LAN):

`http://<pi-ip>:3080`

You should see:

- **API OK** (top right)
- **3-column home** (1024×600): status row, reminders/notes · hero · auth/gateway, quick actions
- Health label matching gateway (`HEALTHY`, `DEGRADED`, …)
- **Restart / Doctor / Logs / Refresh** in the action strip
- **5 taps on clock** opens `/debug`

### 4. ELECROW touchscreen kiosk (optional)

1. Enable autologin to desktop: Raspberry Pi Configuration → System → Auto Login
2. Disable screen blanking (install script’s kiosk script runs `xset` when started)
3. Enable kiosk service:

```bash
sudo systemctl enable concierge-kiosk
sudo systemctl start concierge-kiosk
```

Chromium opens fullscreen to the dashboard on the 7" display.

### 5. Troubleshooting

| Symptom | Check |
|--------|--------|
| API down | `sudo systemctl status concierge-api` and `journalctl -u concierge-api -f` |
| Gateway status flapping | Run the probe comparison loop below; if raw `/readyz` is stable but Concierge flaps, tune probe env vars in `/opt/concierge/.env` |
| OpenClaw always offline | `openclaw gateway status --json`; gateway running? `systemctl --user status` for openclaw |
| Auth probe fails | Set token in `/opt/concierge/.env` if you use gateway token auth |
| Touch works but status wrong | Compare `curl localhost:3080/api/openclaw/status` with CLI output |
| Kiosk blank screen | API must be up first; `curl localhost:3080/api/health` before starting kiosk |
| Google auth / Drive | Open **Settings** or **Reauthenticate** (`/task/reauth`), tap **Reauthenticate Google**. On Pi: `openclaw gateway auth login` if the UI fails. Use `http://127.0.0.1:3080` on the kiosk (not LAN IP over HTTP). |
| Mic busy on Voice | Turn off Voice mode, tap **Release mic**, wait 2s, **Retry mic**. Kiosk must use `http://127.0.0.1:3080`. Allow mic in Chromium site settings once. |

Logs: `journalctl -u concierge-api -f`

Restart API: `sudo systemctl restart concierge-api`

**Gateway status flapping (compare Concierge vs gateway):**

```bash
while true; do
  date -Is
  curl -sf --max-time 5 http://127.0.0.1:18789/readyz && echo readyz=ok || echo readyz=fail
  curl -sf http://127.0.0.1:3080/api/openclaw/status | jq '{state, readyz, reachable: .probe.reachable, probeFailures, checkedAt}'
  sleep 5
done
```

- If **raw `/readyz` also fails** intermittently, inspect OpenClaw gateway logs (`~/.openclaw/logs/gateway.log`) and `systemctl --user status openclaw-gateway.service`.
- If **raw `/readyz` is stable but Concierge shows `probeFailures` climbing**, increase `OPENCLAW_PROBE_TIMEOUT_MS` or `PROBE_FAILURE_THRESHOLD` in `/opt/concierge/.env`, then `sudo systemctl restart concierge-api`.
