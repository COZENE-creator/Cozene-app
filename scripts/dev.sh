#!/usr/bin/env bash
# Cozene Phase 1 — local dev server for the LIFF app.
#
# Serves ./web over HTTP and, if a tunnel tool is installed, exposes it over
# HTTPS (LIFF login requires HTTPS). Use the printed https URL as the LIFF
# Endpoint URL while developing.
#
# Usage:
#   scripts/dev.sh            # serve + auto-detect a tunnel (cloudflared / ngrok)
#   scripts/dev.sh --no-tunnel
#   PORT=9000 scripts/dev.sh
set -euo pipefail

PORT="${PORT:-8080}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT/web"
TUNNEL=1
[[ "${1:-}" == "--no-tunnel" ]] && TUNNEL=0

if [[ ! -f "$WEB_DIR/config.js" ]]; then
  echo "⚠  web/config.js not found. Copy it first:"
  echo "     cp web/config.example.js web/config.js  # then fill in LIFF_ID / ENDPOINT_URL"
  echo
fi

cleanup() { [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ Serving $WEB_DIR at http://localhost:$PORT"
( cd "$WEB_DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
SERVER_PID=$!

if [[ "$TUNNEL" -eq 1 ]]; then
  if command -v cloudflared >/dev/null 2>&1; then
    echo "▶ Starting cloudflared tunnel (https URL below)…"
    cloudflared tunnel --url "http://localhost:$PORT"
  elif command -v ngrok >/dev/null 2>&1; then
    echo "▶ Starting ngrok tunnel (https URL in the ngrok UI)…"
    ngrok http "$PORT"
  else
    echo "ℹ No tunnel tool found (cloudflared or ngrok). Serving HTTP only."
    echo "  Install one for HTTPS, or run with --no-tunnel to silence this."
    echo "  Press Ctrl+C to stop."
    wait "$SERVER_PID"
  fi
else
  echo "  Press Ctrl+C to stop."
  wait "$SERVER_PID"
fi
