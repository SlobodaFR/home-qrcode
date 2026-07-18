#!/bin/sh
set -e

LITESTREAM_CONFIG="${LITESTREAM_CONFIG:-/app/backend/litestream.yml}"

if [ -n "${MINIO_BUCKET}" ]; then
  echo "Restoring database from MinIO replica (if exists)..."
  litestream restore -if-replica-exists -config "${LITESTREAM_CONFIG}" "${DATABASE_PATH}"

  echo "Starting Litestream replication..."
  exec litestream replicate -exec "$*" -config "${LITESTREAM_CONFIG}"
else
  echo "MINIO_BUCKET not set — skipping Litestream, starting directly."
  exec "$@"
fi
