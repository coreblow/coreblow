#!/bin/bash
set -euo pipefail
docker compose run --rm coreblow npm test
