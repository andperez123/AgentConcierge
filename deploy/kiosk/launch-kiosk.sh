#!/usr/bin/env bash
set -euo pipefail

URL="${CONCIERGE_URL:-http://127.0.0.1:3080}"
PROFILE="${CONCIERGE_CHROME_PROFILE:-${HOME}/.config/concierge-chrome}"

find_chromium() {
  for cmd in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "${cmd}" >/dev/null 2>&1; then
      command -v "${cmd}"
      return 0
    fi
  done
  for path in /usr/bin/chromium /usr/lib/chromium/chromium; do
    if [[ -x "${path}" ]]; then
      echo "${path}"
      return 0
    fi
  done
  return 1
}

CHROMIUM="$(find_chromium)" || {
  echo "No Chromium binary found. Install: sudo apt install -y chromium" >&2
  exit 127
}

# Disable screen blanking (ignore errors on Wayland / headless)
if command -v xset >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  xset s off 2>/dev/null || true
  xset -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
fi

# Wait for API
for _ in $(seq 1 60); do
  if curl -sf "${URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

exec "${CHROMIUM}" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --check-for-update-interval=31536000 \
  --user-data-dir="${PROFILE}" \
  --user-agent="ConciergeKiosk/0.1" \
  "${URL}"
