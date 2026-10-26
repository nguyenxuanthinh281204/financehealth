#!/usr/bin/env bash
# Tự cập nhật app khi có image mới trên GitHub. Chạy mỗi 5 phút bằng cron (xem docs/DEPLOY-NATVPS.md mục 8).
# Không có gì mới thì không làm gì, không khởi động lại container nào.
set -euo pipefail
cd "$(dirname "$0")"

# Lần chạy trước chưa xong thì bỏ qua lần này
exec 9>/tmp/financehealth-auto-update.lock
flock -n 9 || exit 0

log() { echo "$(date '+%F %T') $*"; }

old_head=$(git rev-parse HEAD)
git pull --ff-only -q || log "git pull lỗi (có file trong repo bị sửa tay?), vẫn kiểm tra image"
new_head=$(git rev-parse HEAD)

old_images=$(docker compose images -q | sort)
docker compose --progress quiet pull
docker compose --progress quiet up -d --remove-orphans
new_images=$(docker compose images -q | sort)

if [ "$old_head" != "$new_head" ] || [ "$old_images" != "$new_images" ]; then
  log "Đã cập nhật: code ${old_head:0:7} -> ${new_head:0:7}"
  docker compose ps --format '{{.Service}}: {{.Status}}'
  docker image prune -f >/dev/null
fi
