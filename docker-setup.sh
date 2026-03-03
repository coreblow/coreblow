#!/bin/bash
set -euo pipefail

echo "=== CoreBlow Docker Setup ==="
echo "Building images..."
docker compose build

echo "Starting services..."
docker compose up -d

echo "Waiting for health check..."
sleep 3
curl -sf http://localhost:3000/health && echo " ✅ CoreBlow is running!" || echo " ❌ Health check failed"
