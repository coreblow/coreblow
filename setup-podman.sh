#!/bin/bash
set -euo pipefail
echo "=== CoreBlow Podman Setup ==="
podman build -t coreblow .
podman build -t coreblow-sandbox -f Dockerfile.sandbox .
podman build -t coreblow-sandbox-browser -f Dockerfile.sandbox-browser .
echo "✅ All images built successfully"
