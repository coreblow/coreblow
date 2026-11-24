#!/usr/bin/env bash
set -euo pipefail

# CoreBlow v2.1.3 — macOS Installer Wrapper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/install.sh" "$@"
