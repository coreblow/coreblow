#!/bin/bash
set -euo pipefail
echo 'Running test-e2e-full...'
npx vitest run
