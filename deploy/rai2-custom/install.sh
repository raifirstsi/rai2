#!/usr/bin/env bash
set -euo pipefail

echo "=== RAI2 Custom On-Premise Preflight & Installer ==="
command -v docker >/dev/null 2>&1 || { echo "[FAIL] Can cai dat Docker truoc."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "[FAIL] Can cai dat Docker Compose v2."; exit 1; }

AVAIL_KB=$(df -Pk . | awk 'NR==2 {print $4}')
if [ "${AVAIL_KB:-0}" -lt 5242880 ]; then
  echo "[WARN] Dung luong dia con duoi 5GB. Khuyen nghi toi thieu 10GB."
fi

if [ ! -f .env ]; then
  cp .env.custom.example .env
  echo "[ACTION] Da tao file .env mau. Hay dien DOMAIN va RAI2_LICENSE_KEY vao .env roi chay lai ./install.sh"
  exit 1
fi

set -a
source .env
set +a

if [ -z "${DOMAIN:-}" ] || [ "${DOMAIN}" = "ai.doanhnghiep.vn" ]; then
  echo "[FAIL] Hay cau hinh DOMAIN that cua doanh nghiep trong .env"
  exit 1
fi

if [ -z "${RAI2_LICENSE_KEY:-}" ] || [[ ! "${RAI2_LICENSE_KEY}" =~ ^RAI2C1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  echo "[FAIL] RAI2_LICENSE_KEY trong .env khong dung dinh dang RAI2C1.<payload>.<sig>"
  exit 1
fi

if [ -f "../../package.json" ] && [ -f "./Dockerfile" ]; then
  docker compose up -d --build
else
  docker compose pull
  docker compose up -d --no-build
fi
echo "Dang cho runtime & Caddy TLS khoi dong..."
for i in $(seq 1 30); do
  if docker compose exec -T rai2-custom curl -sf http://127.0.0.1:8799/api/health >/dev/null 2>&1; then
    echo "[OK] RAI2 Custom On-Premise da san sang tai https://${DOMAIN}"
    exit 0
  fi
  sleep 2
done
echo "[FAIL] Khong thay /api/health phan hoi sau 60s."
exit 1
