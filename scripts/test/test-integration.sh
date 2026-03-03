#!/bin/bash
set -euo pipefail
echo 'Running test-integration...'
npx vitest run
