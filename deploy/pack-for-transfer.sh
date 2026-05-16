#!/usr/bin/env bash
# Run on Mac — creates ~/Desktop/concierge-bundle.tar.gz (no node_modules)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HOME/Desktop/concierge-bundle.tar.gz}"
cd "${ROOT}/.."
tar czf "${OUT}" \
  --exclude='Concierge/node_modules' \
  --exclude='Concierge/apps/*/dist' \
  --exclude='Concierge/packages/*/dist' \
  --exclude='Concierge/.git' \
  Concierge
echo "Created: ${OUT}"
echo "Copy to Pi USB, then on Pi:"
echo "  tar xzf concierge-bundle.tar.gz -C ~"
echo "  cd ~/Concierge && ./deploy/install-pi.sh"
