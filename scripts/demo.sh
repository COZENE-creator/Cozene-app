#!/usr/bin/env bash
# Cozene — shareable demo from this computer.
#
# Starts the Mother System (admin + API) and the guest Mini App page, exposes
# both through Cloudflare quick tunnels, points web/config.js at the new admin
# URL, and prints the links to send to the client. Links work while this
# script runs; Ctrl+C stops everything. URLs change on every start.
#
# Usage:
#   scripts/demo.sh            # production build (fast for the client)
#   scripts/demo.sh --dev      # next dev (hot reload, slower first loads)
#   STORE=cozene-base MOTHER_PORT=3000 WEB_PORT=8765 scripts/demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="${STORE:-cozene-base}"
MOTHER_PORT="${MOTHER_PORT:-3000}"
WEB_PORT="${WEB_PORT:-8765}"
MODE="prod"
[[ "${1:-}" == "--dev" ]] && MODE="dev"
LOGS="$(mktemp -d -t cozene-demo-XXXX)"
PIDS=()

# Kill a process and everything it started (npx → next → next-server).
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "Stopping demo…"
  for pid in "${PIDS[@]}"; do kill_tree "$pid"; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

die() { echo "✗ $*" >&2; exit 1; }

command -v cloudflared >/dev/null || die "cloudflared is not installed (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)"
for port in "$MOTHER_PORT" "$WEB_PORT"; do
  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    die "Port $port is already in use. Stop that program or pick another port (MOTHER_PORT=… / WEB_PORT=…)."
  fi
done
[[ -f "$ROOT/web/config.js" ]] || die "web/config.js not found — cp web/config.example.js web/config.js and set MINIAPP_LIFF_ID"

LIFF_ID="$(grep -oE 'MINIAPP_LIFF_ID: *"[^"]*"' "$ROOT/web/config.js" | sed -E 's/.*"([^"]*)"/\1/' || true)"
[[ -n "$LIFF_ID" && "$LIFF_ID" != "YOUR_MINIAPP_LIFF_ID" ]] || die "Set MINIAPP_LIFF_ID (the Developing LIFF ID) in web/config.js"

# ─── Mother System ──────────────────────────────────────────────────────────
cd "$ROOT/mother"
if [[ "$MODE" == "prod" ]]; then
  echo "▶ Building the Mother System (about a minute)…"
  npx next build >"$LOGS/build.log" 2>&1 || die "Build failed — see $LOGS/build.log"
  DEFAULT_STORE_SLUG="$STORE" npx next start -p "$MOTHER_PORT" >"$LOGS/mother.log" 2>&1 &
else
  DEFAULT_STORE_SLUG="$STORE" npx next dev -p "$MOTHER_PORT" >"$LOGS/mother.log" 2>&1 &
fi
PIDS+=($!)

# ─── guest page ─────────────────────────────────────────────────────────────
( cd "$ROOT/web" && exec python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 ) >"$LOGS/web.log" 2>&1 &
PIDS+=($!)

# ─── tunnels ────────────────────────────────────────────────────────────────
cloudflared tunnel --no-autoupdate --url "http://localhost:$MOTHER_PORT" >"$LOGS/tunnel-mother.log" 2>&1 &
PIDS+=($!)
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$WEB_PORT" >"$LOGS/tunnel-web.log" 2>&1 &
PIDS+=($!)

tunnel_url() {
  for _ in $(seq 1 60); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$1" | head -1 || true)"
    [[ -n "$url" ]] && { echo "$url"; return 0; }
    sleep 1
  done
  return 1
}

echo "▶ Opening tunnels…"
MOTHER_URL="$(tunnel_url "$LOGS/tunnel-mother.log")" || die "Admin tunnel did not start — see $LOGS/tunnel-mother.log"
WEB_URL="$(tunnel_url "$LOGS/tunnel-web.log")" || die "Guest tunnel did not start — see $LOGS/tunnel-web.log"

# Point the guest page at this run's admin URL (config.js is git-ignored).
sed -i -E "s|ENDPOINT_BASE: *\"[^\"]*\"|ENDPOINT_BASE: \"$MOTHER_URL\"|" "$ROOT/web/config.js"

echo "▶ Waiting for the Mother System…"
for _ in $(seq 1 120); do
  curl -s "http://localhost:$MOTHER_PORT/api/health" >/dev/null && break
  sleep 1
done

cat <<EOF

────────────────────────────────────────────────────────────────────
 Cozene demo is running.  Keep this window open; Ctrl+C stops it.
────────────────────────────────────────────────────────────────────

 1) Paste into LINE Developers → MINI App channel → Web app settings
    → Developing → Endpoint URL  (this changes every start):

      $WEB_URL/miniapp/

 2) Send to the client:

    Mini App (open in LINE on the phone, or scan a printed table QR):
      https://miniapp.line.me/$LIFF_ID?store=$STORE&table=1

    Admin system:
      $MOTHER_URL
      (login: see ADMIN_EMAILS / ADMIN_PASSWORD in mother/.env.local)

 Logs: $LOGS
────────────────────────────────────────────────────────────────────
EOF

wait
