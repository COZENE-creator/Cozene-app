#!/usr/bin/env bash
# Cozene — daily PostgreSQL backup.
#
# Dumps the database named by DATABASE_URL in mother/.env.local to a gzipped
# file, keeps the last KEEP_DAYS days locally, and (optionally) copies each dump
# to S3 so a lost server doesn't take the backups with it.
#
# Usage:
#   scripts/backup-db.sh
#   BACKUP_DIR=~/backups KEEP_DAYS=14 BACKUP_S3_URI=s3://bucket/cozene scripts/backup-db.sh
#
# Cron (daily at 04:00 server time):
#   0 4 * * * /home/ubuntu/cozene/scripts/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Restore (stops the app; replaces the current data):
#   sudo systemctl stop cozene
#   gunzip -c ~/backups/cozene-YYYYMMDD-HHMM.sql.gz | psql "$DATABASE_URL"
#   sudo systemctl start cozene
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/mother/.env.local"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# Read only the lines we need instead of sourcing the whole env file.
env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
DATABASE_URL="${DATABASE_URL:-$(env_value DATABASE_URL)}"
BACKUP_S3_URI="${BACKUP_S3_URI:-$(env_value BACKUP_S3_URI)}"

[[ "$DATABASE_URL" == postgres* ]] || { echo "✗ DATABASE_URL (postgres://…) not found in $ENV_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/cozene-$(date +%Y%m%d-%H%M).sql.gz"

# --clean --if-exists: the dump drops and recreates objects, so it restores onto
# an existing database. Write to .part first so a failed dump never looks valid.
pg_dump --clean --if-exists --no-owner "$DATABASE_URL" | gzip > "$FILE.part"
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"
echo "$(date '+%F %T') ✓ $FILE ($(du -h "$FILE" | cut -f1))"

if [[ -n "$BACKUP_S3_URI" ]]; then
  aws s3 cp --only-show-errors "$FILE" "${BACKUP_S3_URI%/}/$(basename "$FILE")"
  echo "$(date '+%F %T') ✓ copied to ${BACKUP_S3_URI%/}/"
fi

find "$BACKUP_DIR" -name 'cozene-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
