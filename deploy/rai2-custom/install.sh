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

if [ -z "${RAI2_LICENSE_KEY:-}" ] || [ "${RAI2_LICENSE_KEY}" = "RAI2C1.replace_with_signed_token" ]; then
  echo "[FAIL] Thieu RAI2_LICENSE_KEY hop le trong .env"
  exit 1
fi

docker compose up -d --build
echo "Dang cho runtime khoi dong..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8799/api/health >/dev/null 2>&1; then
    echo "[OK] RAI2 Custom On-Premise da san sang tai http://127.0.0.1:8799"
    exit 0
  fi
  sleep 2
done
echo "[FAIL] Khong thay /api/health phan hoi sau 60s."
exit 1
