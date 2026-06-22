#!/usr/bin/env bash
# LLS droplet bootstrap — runs steps 2 through 7 on a fresh Ubuntu 22.04 droplet.
# Idempotent: safe to re-run. Run as root (or with sudo).
#
#   REPO_URL=https://github.com/mcwilliamsmediainc/lls-website-app.git \
#   ./bootstrap.sh
#
# Expects a filled-in .env in the repo root (see deploy/.env.production.example).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mcwilliamsmediainc/lls-website-app.git}"
APP_DIR="${APP_DIR:-/opt/lls-website-app}"

log() { echo "[bootstrap] $*"; }

# --- Step 2: install Docker (engine + compose plugin) ---
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker"
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker root || true
else
  log "Docker already installed: $(docker --version)"
fi
docker compose version >/dev/null 2>&1 || { log "Docker Compose plugin missing"; exit 1; }

# --- Step 3: clone (or update) the repo ---
if [ ! -d "$APP_DIR/.git" ]; then
  log "cloning $REPO_URL -> $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  log "repo present, pulling latest"
  git -C "$APP_DIR" pull --ff-only
fi
cd "$APP_DIR"

# --- Step 4: .env must exist and be filled in ---
if [ ! -f .env ]; then
  log "ERROR: $APP_DIR/.env not found."
  log "Create it from deploy/.env.production.example and set ANTHROPIC_API_KEY, AUTH_SECRET,"
  log "WORKER_API_TOKEN, SEED_DEFAULT_PASSWORD, and DROPLET_PUBLIC_URL, then re-run."
  exit 1
fi
if grep -q "REPLACE_ME\|REPLACE_WITH_DROPLET_IP" .env; then
  log "ERROR: .env still contains REPLACE_ME placeholders. Fill them in and re-run."
  exit 1
fi

# Apply the droplet host override (CORS / onboarding / APP_URL).
cp -f deploy/docker-compose.override.yml docker-compose.override.yml
log ".env present and override applied"

# --- Step 5: build and start the stack ---
log "building and starting the stack"
docker compose up --build -d

# --- Step 7: migrations run via the one-shot 'migrate' service; wait for it to finish ---
log "waiting for the migrate service to complete (applies 0001_initial_schema + seed)"
docker compose wait migrate || log "note: 'docker compose wait' unavailable or migrate already exited"

# --- Step 6: report status ---
log "service status:"
docker compose ps

# --- health probe ---
log "probing API health"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
    log "API healthy"
    break
  fi
  sleep 2
done

log "done. Long-running services: postgres, redis, minio, api, worker, web."
log "One-shot services migrate + createbuckets will show as 'exited (0)' — that is expected."
log "Open the web app at the DROPLET_PUBLIC_URL you set in .env (port 5173)."
