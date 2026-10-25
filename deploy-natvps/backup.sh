#!/usr/bin/env bash
# Sao lưu database + ảnh/video. Chạy hằng ngày bằng cron (xem docs/DEPLOY-VN.md).
set -euo pipefail
cd "$(dirname "$0")"
source .env

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%F)
mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U "$DB_USERNAME" financehealth | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

if [ "${STORAGE_TYPE:-local}" = "local" ]; then
  docker compose run --rm --no-deps --user 0 -v "$BACKUP_DIR":/backup --entrypoint sh api \
    -c "tar czf /backup/uploads-$STAMP.tar.gz -C /app/data uploads"
fi

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup xong: $BACKUP_DIR"
