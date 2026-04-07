#!/bin/bash
set -euo pipefail
cd gateway && npm run build && node dist/index.js "$@"
