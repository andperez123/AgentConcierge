#!/usr/bin/env bash
set -euo pipefail

URL="${CONCIERGE_URL:-http://127.0.0.1:3080}"
PROFILE="${CONCIERGE_CHROME_PROFILE:-${HOME}/.config/concierge-chrome}"

# Disable screen blanking when X is available
if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

# Wait for API
for i in $(seq 1 60); do
  if curl -sf "${URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --check-for-update-interval=31536000 \
  --user-data-dir="${PROFILE}" \
  --user-agent="ConciergeKiosk/0.1" \
  "${URL}"
