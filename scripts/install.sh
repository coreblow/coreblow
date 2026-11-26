#!/usr/bin/env bash
set -euo pipefail

# CoreBlow v2.3.1 — Official macOS / Linux / WSL2 Installer
# Usage:
#   curl -fsSL https://coreblow.com/install.sh | bash
#   bash scripts/install.sh [--from-source] [--non-interactive]

COREBLOW_VERSION="${COREBLOW_VERSION:-2.3.1}"
COREBLOW_REPO_URL="${COREBLOW_REPO_URL:-https://github.com/coreblow/coreblow.git}"
COREBLOW_INSTALL_DIR="${COREBLOW_INSTALL_DIR:-$HOME/.coreblow/src}"
FROM_SOURCE="${COREBLOW_INSTALL_SOURCE:-0}"
NON_INTERACTIVE="${COREBLOW_NON_INTERACTIVE:-0}"

for arg in "$@"; do
  case "$arg" in
    --from-source) FROM_SOURCE="1" ;;
    --non-interactive|--skip-onboard) NON_INTERACTIVE="1" ;;
    -h|--help)
      echo "CoreBlow v${COREBLOW_VERSION} Installer"
      echo "Options:"
      echo "  --from-source       Install from local repo or git clone instead of npm"
      echo "  --non-interactive   Skip interactive 'coreblow onboard' after install"
      exit 0
      ;;
  esac
done

echo ""
echo "  COREBLOW v${COREBLOW_VERSION} — Sovereign Single-Brain Agent OS"
echo "  ──────────────────────────────────────────────────────"

# 1. Verify Node.js >= 22.12.0
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js v22.12+ is required but was not found in PATH."
  echo "  Install Node.js 22+ via Homebrew (brew install node@22), nvm, or https://nodejs.org"
  exit 1
fi

NODE_RAW="$(node -v | sed 's/^v//')"
NODE_MAJOR="$(echo "$NODE_RAW" | cut -d. -f1)"
NODE_MINOR="$(echo "$NODE_RAW" | cut -d. -f2)"

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 12 ]; }; then
  echo "✗ Node.js v22.12+ is required (found v${NODE_RAW})."
  echo "  Upgrade with: nvm install 22 && nvm use 22"
  exit 1
fi
echo "✓ Node.js v${NODE_RAW} detected"

# 2. Detect local repo checkout or install globally via npm
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ "$FROM_SOURCE" = "1" ] || { [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../coreblow.mjs" ]; }; then
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../coreblow.mjs" ]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    echo "✓ Using local CoreBlow repository at ${REPO_ROOT}"
  else
    echo "→ Cloning CoreBlow into ${COREBLOW_INSTALL_DIR}..."
    mkdir -p "$(dirname "$COREBLOW_INSTALL_DIR")"
    if [ -d "$COREBLOW_INSTALL_DIR/.git" ]; then
      git -C "$COREBLOW_INSTALL_DIR" pull --ff-only
    else
      git clone --depth 1 "$COREBLOW_REPO_URL" "$COREBLOW_INSTALL_DIR"
    fi
    REPO_ROOT="$COREBLOW_INSTALL_DIR"
  fi

  echo "→ Installing dependencies..."
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$REPO_ROOT" && pnpm install)
  elif command -v corepack >/dev/null 2>&1; then
    (cd "$REPO_ROOT" && corepack pnpm install)
  else
    (cd "$REPO_ROOT" && npm install)
  fi

  chmod +x "$REPO_ROOT/coreblow.mjs"
  BIN_DIR=""
  if [ -d "/opt/homebrew/bin" ] && [ -w "/opt/homebrew/bin" ]; then
    BIN_DIR="/opt/homebrew/bin"
  elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    BIN_DIR="/usr/local/bin"
  else
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
  fi

  ln -sf "$REPO_ROOT/coreblow.mjs" "$BIN_DIR/coreblow"
  echo "✓ Linked 'coreblow' CLI to ${BIN_DIR}/coreblow"

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      echo "  Note: Add ${BIN_DIR} to your PATH:"
      echo "    export PATH=\"${BIN_DIR}:\$PATH\""
      ;;
  esac
else
  echo "→ Installing coreblow@${COREBLOW_VERSION} globally via npm..."
  if ! npm install -g "coreblow@latest" 2>/dev/null; then
    echo "  Notice: Global npm install failed with permission issues; falling back to \$HOME/.local prefix..."
    mkdir -p "$HOME/.local/bin"
    npm install -g --prefix "$HOME/.local" "coreblow@latest"
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) ;;
      *)
        echo "  Note: Add $HOME/.local/bin to your PATH:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        export PATH="$HOME/.local/bin:$PATH"
        ;;
    esac
  fi
fi

# 3. Verify installation
if command -v coreblow >/dev/null 2>&1; then
  INSTALLED_VER="$(coreblow --version 2>/dev/null || true)"
  echo "✓ Installed: ${INSTALLED_VER:-CoreBlow v${COREBLOW_VERSION}}"
else
  echo "✓ Installation finished. Restart your terminal if 'coreblow' is not yet in PATH."
fi

# 4. Optional first-time onboarding
if [ "$NON_INTERACTIVE" != "1" ] && [ -t 0 ] && [ -t 1 ] && command -v coreblow >/dev/null 2>&1; then
  echo ""
  echo "→ Launching interactive setup (coreblow onboard)..."
  coreblow onboard || true
fi

echo ""
echo "  CoreBlow is ready! Quick commands:"
echo "    coreblow                  Launch interactive TUI"
echo "    coreblow -p \"review\"      Headless query with stdin pipe & JSON/NDJSON support"
echo "    coreblow -c               Continue last workspace session"
echo "    coreblow -r               Resume session via interactive SQLite FTS5 picker"
echo "    coreblow bots             Manage 24/7 bot messaging channels & loop guards"
echo "    coreblow cron             Orchestrate 24/7 cron jobs"
echo "    coreblow desktop          Open CoreBlow Studio Desktop"
echo "    coreblow gateway          Start Single-Brain Gateway (:18789)"
echo "    coreblow doctor           Run system health diagnostics"
echo ""
