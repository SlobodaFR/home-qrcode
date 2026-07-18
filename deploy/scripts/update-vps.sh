#!/bin/sh
set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/qrcode}"
IMAGE="${IMAGE:-ghcr.io/slobodafr/home-qrcode}"

cd "$DEPLOY_DIR/deploy"

export IMAGE
export IMAGE_TAG

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f

sudo mkdir -p /etc/caddy/sites
sudo cp "$DEPLOY_DIR/deploy/Caddyfile" /etc/caddy/sites/qrcode.Caddyfile

if ! grep -q '^import sites/\*$' /etc/caddy/Caddyfile 2>/dev/null; then
  echo 'import sites/*' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
