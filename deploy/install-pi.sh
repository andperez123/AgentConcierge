#!/usr/bin/env bash
# Run on the Raspberry Pi from the Concierge repo root:
#   chmod +x deploy/install-pi.sh && ./deploy/install-pi.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${CONCIERGE_INSTALL_DIR:-/opt/concierge}"
PI_USER="${SUDO_USER:-$USER}"
PI_HOME="$(eval echo "~${PI_USER}")"
PI_UID="$(id -u "${PI_USER}")"

echo "==> Building Concierge in ${ROOT}"
cd "${ROOT}"
npm ci
npm run build

echo "==> Installing to ${INSTALL_DIR}"
sudo mkdir -p "${INSTALL_DIR}"
sudo rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  "${ROOT}/" "${INSTALL_DIR}/"

cd "${INSTALL_DIR}"
npm ci --omit=dev

sudo mkdir -p "${INSTALL_DIR}/data"
sudo chown -R "${PI_USER}:${PI_USER}" "${INSTALL_DIR}"

echo "==> Installing systemd units (user: ${PI_USER})"
sed -e "s|@CONCIERGE_USER@|${PI_USER}|g" \
  -e "s|@CONCIERGE_HOME@|${PI_HOME}|g" \
  -e "s|@CONCIERGE_UID@|${PI_UID}|g" \
  -e "s|@CONCIERGE_NPM_BIN@|${PI_HOME}/.npm-global/bin|g" \
  "${INSTALL_DIR}/deploy/systemd/concierge-api.service" \
  | sudo tee /etc/systemd/system/concierge-api.service >/dev/null
sed -e "s|@CONCIERGE_USER@|${PI_USER}|g" \
  -e "s|@CONCIERGE_HOME@|${PI_HOME}|g" \
  "${INSTALL_DIR}/deploy/systemd/concierge-kiosk.service" \
  | sudo tee /etc/systemd/system/concierge-kiosk.service >/dev/null
sudo chmod +x "${INSTALL_DIR}/deploy/kiosk/launch-kiosk.sh"

sudo systemctl daemon-reload
sudo systemctl enable concierge-api
sudo systemctl restart concierge-api

echo ""
echo "Concierge API installed. Test: curl http://127.0.0.1:3080/api/health"
echo ""
echo "Optional kiosk (needs desktop autologin):"
echo "  sudo systemctl enable concierge-kiosk"
echo "  sudo systemctl start concierge-kiosk"
echo ""
echo "Open in browser: http://$(hostname -I | awk '{print $1}'):3080"
