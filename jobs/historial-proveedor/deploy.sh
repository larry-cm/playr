#!/usr/bin/env bash
# Despliega el job en Railway subiendo SOLO el bundle (sin repo ni node_modules): build de segundos e imagen minima.
# Uso, desde la raiz del repo:  bash jobs/historial-proveedor/deploy.sh
# Requiere .env.railway-cli (RAILWAY_PROJECT_TOKEN, RAILWAY_SERVICE_ID) en la raiz del repo principal o de este checkout.
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
env_file="$raiz/.env.railway-cli"
[ -f "$env_file" ] || env_file="$(git -C "$raiz" rev-parse --path-format=absolute --git-common-dir)/../.env.railway-cli"
[ -f "$env_file" ] || { echo "falta .env.railway-cli" >&2; exit 1; }
set -a; . "$env_file"; set +a
: "${RAILWAY_PROJECT_TOKEN:?falta RAILWAY_PROJECT_TOKEN}" "${RAILWAY_SERVICE_ID:?falta RAILWAY_SERVICE_ID}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cd "$raiz"
pnpm dlx esbuild@0.28.2 jobs/historial-proveedor/sync.ts --bundle --platform=node --target=node24 --format=esm --minify \
    --log-level=warning --outfile="$tmp/sync.mjs"

cp jobs/historial-proveedor/Dockerfile.runtime "$tmp/Dockerfile"
cp jobs/historial-proveedor/railway.runtime.json "$tmp/railway.json"

cd "$tmp"
RAILWAY_TOKEN="$RAILWAY_PROJECT_TOKEN" "$raiz/node_modules/.bin/railway" up --ci --service "$RAILWAY_SERVICE_ID" \
    --message "historial-proveedor $(git -C "$raiz" rev-parse --short HEAD)"
