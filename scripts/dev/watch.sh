#!/bin/bash
set -euo pipefail
cd gateway && npx tsc --watch &
npx nodemon dist/index.js
