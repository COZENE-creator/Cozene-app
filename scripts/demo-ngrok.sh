#!/usr/bin/env bash
# Cozene — demo on a fixed ngrok domain.
#
# The Mother System serves both the admin console and the guest Mini App
# (/miniapp), so one free ngrok static domain carries everything and the LINE
# settings never change between runs. Works while this script runs; Ctrl+C
# stops it.
#
# One-time setup:
#   ngrok config add-authtoken <token>          # ngrok dashboard → Your Authtoken
#   claim a free static domain                  # ngrok dashboard → Domains
#   add NGROK_DOMAIN=<name>.ngrok-free.app to mother/.env.local
#
# Usage:
#   scripts/demo-ngrok.sh            # production build
#   scripts/demo-ngrok.sh --dev      # next dev (hot reload)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/mother/.env.local"
PORT="${MOTHER_PORT:-3000}"
STORE="${STORE:-cozene-base}"
MODE="prod"
[[ "${1:-}" == "--dev" ]] && MODE="dev"
LOGS="$(mktemp -d -t cozene-ngrok-XXXX)"
PIDS=()

die() { echo "✗ $*" >&2; exit 1; }

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

env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

DOMAIN="${NGROK_DOMAIN:-$(env_value NGROK_DOMAIN)}"
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"
LIFF_ID="$(env_value MINIAPP_PAGE_LIFF_ID)"

command -v ngrok >/dev/null || die "ngrok is not installed"
ngrok config check >/dev/null 2>&1 || die "Run: ngrok config add-authtoken <token>"
[[ -n "$DOMAIN" ]] || die "Set NGROK_DOMAIN=<name>.ngrok-free.app in mother/.env.local"
[[ -n "$LIFF_ID" ]] || die "Set MINIAPP_PAGE_LIFF_ID (the Developing LIFF ID) in mother/.env.local"
ss -ltn 2>/dev/null | grep -q ":$PORT " && die "Port $PORT is already in use"

cd "$ROOT/mother"
if [[ "$MODE" == "prod" ]]; then
  echo "▶ Building the Mother System (about a minute)…"
  npx next build >"$LOGS/build.log" 2>&1 || die "Build failed — see $LOGS/build.log"
  DEFAULT_STORE_SLUG="$STORE" npx next start -p "$PORT" >"$LOGS/mother.log" 2>&1 &
else
  DEFAULT_STORE_SLUG="$STORE" npx next dev -p "$PORT" >"$LOGS/mother.log" 2>&1 &
fi
PIDS+=($!)

echo "▶ Waiting for the Mother System…"
for _ in $(seq 1 120); do
  curl -s "http://localhost:$PORT/api/health" >/dev/null && break
  sleep 1
done

echo "▶ Starting ngrok on https://$DOMAIN …"
ngrok http --url="https://$DOMAIN" "$PORT" --log=stdout >"$LOGS/ngrok.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 30); do
  grep -q "started tunnel" "$LOGS/ngrok.log" && break
  grep -qiE "ERR_NGROK|error" "$LOGS/ngrok.log" && die "ngrok failed: $(grep -iE 'ERR_NGROK|err=' "$LOGS/ngrok.log" | head -1)"
  sleep 1
done

cat <<EOT

────────────────────────────────────────────────────────────────────
 Cozene demo is running on a fixed address. Ctrl+C stops it.
────────────────────────────────────────────────────────────────────

 LINE settings (set once — they stay valid every run):
   MINI App → Web app settings → Developing → Endpoint URL:
     https://$DOMAIN/miniapp
   Messaging API → Webhook URL:
     https://$DOMAIN/api/webhooks/line

 Send to the client:
   Mini App (open in LINE):
     https://miniapp.line.me/$LIFF_ID?store=$STORE&table=1
   Admin system:
     https://$DOMAIN
     (login: ADMIN_EMAILS / ADMIN_PASSWORD in mother/.env.local)

 Logs: $LOGS
────────────────────────────────────────────────────────────────────
EOT

wait
