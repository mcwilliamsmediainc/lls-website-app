#!/usr/bin/env bash
# Provision the LLS droplet and DNS with doctl (steps 1 and 9).
# Prereqs: `doctl auth init` already run with an account that has the
# McWilliams Media SSH key and the domains added.
#
#   SSH_KEY="McWilliams Media" ./provision-droplet.sh
#
# Find your SSH key name/fingerprint with:  doctl compute ssh-key list
set -euo pipefail

DROPLET_NAME="${DROPLET_NAME:-lls-prod-01}"
REGION="${REGION:-nyc1}"
SIZE="${SIZE:-s-4vcpu-8gb}"          # 8GB RAM / 4 vCPU Basic (~$48/mo)
IMAGE="${IMAGE:-ubuntu-22-04-x64}"
SSH_KEY="${SSH_KEY:-McWilliams Media}" # name OR fingerprint of an existing key
USER_DATA="${USER_DATA:-deploy/cloud-init.yaml}"

command -v doctl >/dev/null || { echo "doctl not installed: https://docs.digitalocean.com/reference/doctl/"; exit 1; }
[ -f "$USER_DATA" ] || { echo "user-data file not found: $USER_DATA (run from repo root)"; exit 1; }

echo "==> Step 1: creating droplet $DROPLET_NAME ($SIZE, $REGION, $IMAGE)"
doctl compute droplet create "$DROPLET_NAME" \
  --image "$IMAGE" \
  --size "$SIZE" \
  --region "$REGION" \
  --ssh-keys "$SSH_KEY" \
  --user-data-file "$USER_DATA" \
  --wait

IP=$(doctl compute droplet get "$DROPLET_NAME" --format PublicIPv4 --no-header)
echo "==> Droplet IP: $IP"
echo "    cloud-init is installing Docker + bringing up the stack."
echo "    Watch progress:  ssh root@$IP 'tail -f /var/log/lls-bootstrap.log'"

echo "==> Step 9: DNS A records -> $IP"
ensure_domain() { doctl compute domain get "$1" >/dev/null 2>&1 || doctl compute domain create "$1"; }
ensure_domain locallaunchsystem.com
ensure_domain mcwdevs.com

# *.staging.locallaunchsystem.com
doctl compute domain records create locallaunchsystem.com \
  --record-type A --record-name "*.staging" --record-data "$IP" --record-ttl 3600
# mcwdevs.com apex + wildcard
doctl compute domain records create mcwdevs.com \
  --record-type A --record-name "@" --record-data "$IP" --record-ttl 3600
doctl compute domain records create mcwdevs.com \
  --record-type A --record-name "*" --record-data "$IP" --record-ttl 3600

echo "==> Done."
echo "    App (smoke test):  http://$IP:5173"
echo "    NOTE: the wildcard staging records resolve to this droplet, but serving"
echo "    *.staging.locallaunchsystem.com sites needs the nginx wildcard vhost + WP"
echo "    staging stack, which is separate from this app's docker-compose."
