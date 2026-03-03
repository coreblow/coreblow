#!/bin/bash
set -euo pipefail
echo "Starting CoreBlow in development mode..."
cd gateway && npm run dev
