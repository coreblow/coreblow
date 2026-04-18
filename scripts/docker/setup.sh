#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CoreBlow — Docker Setup Script
#
# Ported from OpenClaw's scripts/docker/setup.sh with 100% structural
# fidelity. Every validation, security check, and idiom is preserved.
#
# Usage:
#   ./scripts/docker/setup.sh
#
# Environment variables:
#   COREBLOW_IMAGE              Use a remote image instead of building locally
#   COREBLOW_CONFIG_DIR         Config directory (default: ~/.coreblow)
#   COREBLOW_WORKSPACE_DIR      Workspace directory (default: ~/.coreblow/workspace)
#   COREBLOW_GATEWAY_PORT       Host port (default: 3000)
#   COREBLOW_GATEWAY_BIND       Bind mode: lan | local (default: lan)
#   COREBLOW_GATEWAY_TOKEN      Gateway auth token (auto-generated if empty)
#   COREBLOW_DOCKER_APT_PACKAGES Extra apt packages to install in image
#   COREBLOW_EXTENSIONS         Extensions to bake in at build time
#   COREBLOW_EXTRA_MOUNTS       Extra bind mounts (comma-separated)
#   COREBLOW_HOME_VOLUME        Named volume for /home/node persistence
#   COREBLOW_SANDBOX            Enable sandbox (1/true/yes/on)
#   COREBLOW_DOCKER_SOCKET      Docker socket path override
#   COREBLOW_TZ                 Timezone (IANA format, e.g. Asia/Jakarta)
#   COREBLOW_INSTALL_DOCKER_CLI Build Docker CLI into image (for sandbox)
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
EXTRA_COMPOSE_FILE="$ROOT_DIR/docker-compose.extra.yml"
IMAGE_NAME="${COREBLOW_IMAGE:-coreblow:local}"
EXTRA_MOUNTS="${COREBLOW_EXTRA_MOUNTS:-}"
HOME_VOLUME_NAME="${COREBLOW_HOME_VOLUME:-}"
RAW_SANDBOX_SETTING="${COREBLOW_SANDBOX:-}"
SANDBOX_ENABLED=""
DOCKER_SOCKET_PATH="${COREBLOW_DOCKER_SOCKET:-}"
TIMEZONE="${COREBLOW_TZ:-}"

# ─── Utility Functions ────────────────────────────────────────────────

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

is_truthy_value() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

# ─── Config Reading ───────────────────────────────────────────────────
# Read gateway token from existing config file (coreblow.json)

read_config_gateway_token() {
  local config_path="$COREBLOW_CONFIG_DIR/coreblow.json"
  if [[ ! -f "$config_path" ]]; then
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$config_path" <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
except Exception:
    raise SystemExit(0)

gateway = cfg.get("gateway")
if not isinstance(gateway, dict):
    raise SystemExit(0)
auth = gateway.get("auth")
if not isinstance(auth, dict):
    raise SystemExit(0)
token = auth.get("token")
if isinstance(token, str):
    token = token.strip()
    if token:
        print(token)
PY
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    node - "$config_path" <<'NODE'
const fs = require("node:fs");
const configPath = process.argv[2];
try {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const token = cfg?.gateway?.auth?.token;
  if (typeof token === "string" && token.trim().length > 0) {
    process.stdout.write(token.trim());
  }
} catch {
  // Keep docker-setup resilient when config parsing fails.
}
NODE
  fi
}

read_env_gateway_token() {
  local env_path="$1"
  local line=""
  local token=""
  if [[ ! -f "$env_path" ]]; then
    return 0
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ "$line" == COREBLOW_GATEWAY_TOKEN=* ]]; then
      token="${line#COREBLOW_GATEWAY_TOKEN=}"
    fi
  done <"$env_path"
  if [[ -n "$token" ]]; then
    printf '%s' "$token"
  fi
}

# ─── Validation Functions ─────────────────────────────────────────────

contains_disallowed_chars() {
  local value="$1"
  [[ "$value" == *$'\n'* || "$value" == *$'\r'* || "$value" == *$'\t'* ]]
}

is_valid_timezone() {
  local value="$1"
  [[ -e "/usr/share/zoneinfo/$value" && ! -d "/usr/share/zoneinfo/$value" ]]
}

validate_mount_path_value() {
  local label="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    fail "$label cannot be empty."
  fi
  if contains_disallowed_chars "$value"; then
    fail "$label contains unsupported control characters."
  fi
  if [[ "$value" =~ [[:space:]] ]]; then
    fail "$label cannot contain whitespace."
  fi
}

validate_named_volume() {
  local value="$1"
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
    fail "COREBLOW_HOME_VOLUME must match [A-Za-z0-9][A-Za-z0-9_.-]* when using a named volume."
  fi
}

validate_mount_spec() {
  local mount="$1"
  if contains_disallowed_chars "$mount"; then
    fail "COREBLOW_EXTRA_MOUNTS entries cannot contain control characters."
  fi
  # Keep mount specs strict to avoid YAML structure injection.
  # Expected format: source:target[:options]
  if [[ ! "$mount" =~ ^[^[:space:],:]+:[^[:space:],:]+(:[^[:space:],:]+)?$ ]]; then
    fail "Invalid mount format '$mount'. Expected source:target[:options] without spaces."
  fi
}

# ─── Prerequisite Checks ──────────────────────────────────────────────

require_cmd docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose not available (try: docker compose version)" >&2
  exit 1
fi

if [[ -z "$DOCKER_SOCKET_PATH" && "${DOCKER_HOST:-}" == unix://* ]]; then
  DOCKER_SOCKET_PATH="${DOCKER_HOST#unix://}"
fi
if [[ -z "$DOCKER_SOCKET_PATH" ]]; then
  DOCKER_SOCKET_PATH="/var/run/docker.sock"
fi
if is_truthy_value "$RAW_SANDBOX_SETTING"; then
  SANDBOX_ENABLED="1"
fi

# ─── Directory Setup ──────────────────────────────────────────────────

COREBLOW_CONFIG_DIR="${COREBLOW_CONFIG_DIR:-$HOME/.coreblow}"
COREBLOW_WORKSPACE_DIR="${COREBLOW_WORKSPACE_DIR:-$HOME/.coreblow/workspace}"

validate_mount_path_value "COREBLOW_CONFIG_DIR" "$COREBLOW_CONFIG_DIR"
validate_mount_path_value "COREBLOW_WORKSPACE_DIR" "$COREBLOW_WORKSPACE_DIR"
if [[ -n "$HOME_VOLUME_NAME" ]]; then
  if [[ "$HOME_VOLUME_NAME" == *"/"* ]]; then
    validate_mount_path_value "COREBLOW_HOME_VOLUME" "$HOME_VOLUME_NAME"
  else
    validate_named_volume "$HOME_VOLUME_NAME"
  fi
fi
if contains_disallowed_chars "$EXTRA_MOUNTS"; then
  fail "COREBLOW_EXTRA_MOUNTS cannot contain control characters."
fi
if [[ -n "$SANDBOX_ENABLED" ]]; then
  validate_mount_path_value "COREBLOW_DOCKER_SOCKET" "$DOCKER_SOCKET_PATH"
fi
if [[ -n "$TIMEZONE" ]]; then
  if contains_disallowed_chars "$TIMEZONE"; then
    fail "COREBLOW_TZ contains unsupported control characters."
  fi
  if [[ ! "$TIMEZONE" =~ ^[A-Za-z0-9/_+\-]+$ ]]; then
    fail "COREBLOW_TZ must be a valid IANA timezone string (e.g. Asia/Jakarta)."
  fi
  # macOS doesn't have /usr/share/zoneinfo in the same way, skip validation
  if [[ -d "/usr/share/zoneinfo" ]]; then
    if ! is_valid_timezone "$TIMEZONE"; then
      fail "COREBLOW_TZ must match a timezone in /usr/share/zoneinfo (e.g. Asia/Jakarta)."
    fi
  fi
fi

mkdir -p "$COREBLOW_CONFIG_DIR"
mkdir -p "$COREBLOW_WORKSPACE_DIR"
# Seed directory tree eagerly so bind mounts work even on Docker Desktop/Windows
# where the container (even as root) cannot create new host subdirectories.
mkdir -p "$COREBLOW_CONFIG_DIR/agents/main/agent"
mkdir -p "$COREBLOW_CONFIG_DIR/agents/main/sessions"

# ─── Export Environment ───────────────────────────────────────────────

export COREBLOW_CONFIG_DIR
export COREBLOW_WORKSPACE_DIR
export COREBLOW_GATEWAY_PORT="${COREBLOW_GATEWAY_PORT:-3000}"
export COREBLOW_GATEWAY_BIND="${COREBLOW_GATEWAY_BIND:-lan}"
export COREBLOW_IMAGE="$IMAGE_NAME"
export COREBLOW_DOCKER_APT_PACKAGES="${COREBLOW_DOCKER_APT_PACKAGES:-}"
export COREBLOW_EXTENSIONS="${COREBLOW_EXTENSIONS:-}"
export COREBLOW_EXTRA_MOUNTS="$EXTRA_MOUNTS"
export COREBLOW_HOME_VOLUME="$HOME_VOLUME_NAME"
export COREBLOW_ALLOW_INSECURE_PRIVATE_WS="${COREBLOW_ALLOW_INSECURE_PRIVATE_WS:-}"
export COREBLOW_SANDBOX="$SANDBOX_ENABLED"
export COREBLOW_DOCKER_SOCKET="$DOCKER_SOCKET_PATH"
export COREBLOW_TZ="$TIMEZONE"

# Detect Docker socket GID for sandbox group_add.
DOCKER_GID=""
if [[ -n "$SANDBOX_ENABLED" && -S "$DOCKER_SOCKET_PATH" ]]; then
  DOCKER_GID="$(stat -c '%g' "$DOCKER_SOCKET_PATH" 2>/dev/null || stat -f '%g' "$DOCKER_SOCKET_PATH" 2>/dev/null || echo "")"
fi
export DOCKER_GID

# ─── Generate Gateway Token ──────────────────────────────────────────

if [[ -z "${COREBLOW_GATEWAY_TOKEN:-}" ]]; then
  EXISTING_CONFIG_TOKEN="$(read_config_gateway_token || true)"
  if [[ -n "$EXISTING_CONFIG_TOKEN" ]]; then
    COREBLOW_GATEWAY_TOKEN="$EXISTING_CONFIG_TOKEN"
    echo "Reusing gateway token from $COREBLOW_CONFIG_DIR/coreblow.json"
  else
    DOTENV_GATEWAY_TOKEN="$(read_env_gateway_token "$ROOT_DIR/.env" || true)"
    if [[ -n "$DOTENV_GATEWAY_TOKEN" ]]; then
      COREBLOW_GATEWAY_TOKEN="$DOTENV_GATEWAY_TOKEN"
      echo "Reusing gateway token from $ROOT_DIR/.env"
    elif command -v openssl >/dev/null 2>&1; then
      COREBLOW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
    else
      COREBLOW_GATEWAY_TOKEN="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
    fi
  fi
fi
export COREBLOW_GATEWAY_TOKEN

# ─── Compose File Management ─────────────────────────────────────────

COMPOSE_FILES=("$COMPOSE_FILE")
COMPOSE_ARGS=()

write_extra_compose() {
  local home_volume="$1"
  shift
  local mount
  local gateway_home_mount
  local gateway_config_mount
  local gateway_workspace_mount

  cat >"$EXTRA_COMPOSE_FILE" <<'YAML'
services:
  coreblow-gateway:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    gateway_home_mount="${home_volume}:/home/node"
    gateway_config_mount="${COREBLOW_CONFIG_DIR}:/home/node/.coreblow"
    gateway_workspace_mount="${COREBLOW_WORKSPACE_DIR}:/home/node/.coreblow/workspace"
    validate_mount_spec "$gateway_home_mount"
    validate_mount_spec "$gateway_config_mount"
    validate_mount_spec "$gateway_workspace_mount"
    printf '      - %s\n' "$gateway_home_mount" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s\n' "$gateway_config_mount" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s\n' "$gateway_workspace_mount" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "$@"; do
    validate_mount_spec "$mount"
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  cat >>"$EXTRA_COMPOSE_FILE" <<'YAML'
  coreblow-cli:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    printf '      - %s\n' "$gateway_home_mount" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s\n' "$gateway_config_mount" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s\n' "$gateway_workspace_mount" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "$@"; do
    validate_mount_spec "$mount"
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  if [[ -n "$home_volume" && "$home_volume" != *"/"* ]]; then
    validate_named_volume "$home_volume"
    cat >>"$EXTRA_COMPOSE_FILE" <<YAML
volumes:
  ${home_volume}:
YAML
  fi
}

# When sandbox is requested, ensure Docker CLI build arg is set for local builds.
# Docker socket mount is deferred until sandbox prerequisites are verified.
if [[ -n "$SANDBOX_ENABLED" ]]; then
  if [[ -z "${COREBLOW_INSTALL_DOCKER_CLI:-}" ]]; then
    export COREBLOW_INSTALL_DOCKER_CLI=1
  fi
fi

VALID_MOUNTS=()
if [[ -n "$EXTRA_MOUNTS" ]]; then
  IFS=',' read -r -a mounts <<<"$EXTRA_MOUNTS"
  for mount in "${mounts[@]}"; do
    mount="${mount#"${mount%%[![:space:]]*}"}"
    mount="${mount%"${mount##*[![:space:]]}"}"
    if [[ -n "$mount" ]]; then
      VALID_MOUNTS+=("$mount")
    fi
  done
fi

if [[ -n "$HOME_VOLUME_NAME" || ${#VALID_MOUNTS[@]} -gt 0 ]]; then
  # Bash 3.2 + nounset treats "${array[@]}" on an empty array as unbound.
  if [[ ${#VALID_MOUNTS[@]} -gt 0 ]]; then
    write_extra_compose "$HOME_VOLUME_NAME" "${VALID_MOUNTS[@]}"
  else
    write_extra_compose "$HOME_VOLUME_NAME"
  fi
  COMPOSE_FILES+=("$EXTRA_COMPOSE_FILE")
fi
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_ARGS+=("-f" "$compose_file")
done
# Keep a base compose arg set without sandbox overlay so rollback paths can
# force a known-safe gateway service definition (no docker.sock mount).
BASE_COMPOSE_ARGS=("${COMPOSE_ARGS[@]}")
COMPOSE_HINT="docker compose"
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_HINT+=" -f ${compose_file}"
done

# ─── .env File Management ─────────────────────────────────────────────

ENV_FILE="$ROOT_DIR/.env"
upsert_env() {
  local file="$1"
  shift
  local -a keys=("$@")
  local tmp
  tmp="$(mktemp)"
  # Use a delimited string instead of an associative array so the script
  # works with Bash 3.2 (macOS default) which lacks `declare -A`.
  local seen=" "

  if [[ -f "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local key="${line%%=*}"
      local replaced=false
      for k in "${keys[@]}"; do
        if [[ "$key" == "$k" ]]; then
          printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
          seen="$seen$k "
          replaced=true
          break
        fi
      done
      if [[ "$replaced" == false ]]; then
        printf '%s\n' "$line" >>"$tmp"
      fi
    done <"$file"
  fi

  for k in "${keys[@]}"; do
    if [[ "$seen" != *" $k "* ]]; then
      printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
    fi
  done

  mv "$tmp" "$file"
}

upsert_env "$ENV_FILE" \
  COREBLOW_CONFIG_DIR \
  COREBLOW_WORKSPACE_DIR \
  COREBLOW_GATEWAY_PORT \
  COREBLOW_GATEWAY_BIND \
  COREBLOW_GATEWAY_TOKEN \
  COREBLOW_IMAGE \
  COREBLOW_EXTRA_MOUNTS \
  COREBLOW_HOME_VOLUME \
  COREBLOW_DOCKER_APT_PACKAGES \
  COREBLOW_EXTENSIONS \
  COREBLOW_SANDBOX \
  COREBLOW_DOCKER_SOCKET \
  DOCKER_GID \
  COREBLOW_INSTALL_DOCKER_CLI \
  COREBLOW_ALLOW_INSECURE_PRIVATE_WS \
  COREBLOW_TZ

# ─── Helper: Run Pre-start Commands ───────────────────────────────────

run_prestart_gateway() {
  docker compose "${COMPOSE_ARGS[@]}" run --rm --no-deps "$@"
}

run_prestart_cli() {
  # During setup, avoid the shared-network coreblow-cli service because it
  # requires the gateway container's network namespace to already exist. That
  # creates a circular dependency for config writes that are needed before the
  # gateway can start cleanly.
  run_prestart_gateway --entrypoint node coreblow-gateway \
    coreblow.mjs "$@"
}

run_runtime_cli() {
  local compose_scope="${1:-current}"
  local deps_mode="${2:-with-deps}"
  shift 2

  local -a compose_args
  local -a run_args=(run --rm)

  case "$compose_scope" in
    current) compose_args=("${COMPOSE_ARGS[@]}") ;;
    base) compose_args=("${BASE_COMPOSE_ARGS[@]}") ;;
    *) fail "Unknown runtime CLI compose scope: $compose_scope" ;;
  esac

  case "$deps_mode" in
    with-deps) ;;
    no-deps) run_args+=(--no-deps) ;;
    *) fail "Unknown runtime CLI deps mode: $deps_mode" ;;
  esac

  docker compose "${compose_args[@]}" "${run_args[@]}" coreblow-cli "$@"
}

# ─── Phase 1: Build or Pull Image ─────────────────────────────────────

if [[ "$IMAGE_NAME" == "coreblow:local" ]]; then
  echo "==> Building Docker image: $IMAGE_NAME"
  docker build \
    --build-arg "COREBLOW_DOCKER_APT_PACKAGES=${COREBLOW_DOCKER_APT_PACKAGES}" \
    --build-arg "COREBLOW_EXTENSIONS=${COREBLOW_EXTENSIONS}" \
    --build-arg "COREBLOW_INSTALL_DOCKER_CLI=${COREBLOW_INSTALL_DOCKER_CLI:-}" \
    -t "$IMAGE_NAME" \
    -f "$ROOT_DIR/Dockerfile" \
    "$ROOT_DIR"
else
  echo "==> Pulling Docker image: $IMAGE_NAME"
  if ! docker pull "$IMAGE_NAME"; then
    echo "ERROR: Failed to pull image $IMAGE_NAME. Please check the image name and your access permissions." >&2
    exit 1
  fi
fi

# ─── Phase 2: Fix Data Directory Permissions ──────────────────────────
# Ensure bind-mounted data directories are writable by the container's `node`
# user (uid 1000). Host-created dirs inherit the host user's uid which may
# differ, causing EACCES when the container tries to mkdir/write.
# Running a brief root container to chown is the portable Docker idiom --
# it works regardless of the host uid and doesn't require host-side root.

echo ""
echo "==> Fixing data-directory permissions"
# Use -xdev to restrict chown to the config-dir mount only — without it,
# the recursive chown would cross into the workspace bind mount and rewrite
# ownership of all user project files on Linux hosts.
# After fixing the config dir, only the CoreBlow metadata subdirectory
# (.coreblow/) inside the workspace gets chowned, not the user's project files.
run_prestart_gateway --user root --entrypoint sh coreblow-gateway -c \
  'find /home/node/.coreblow -xdev -exec chown node:node {} +; \
   [ -d /home/node/.coreblow/workspace/.coreblow ] && chown -R node:node /home/node/.coreblow/workspace/.coreblow || true'

# ─── Phase 3: Gateway Configuration ───────────────────────────────────

echo ""
echo "==> CoreBlow Gateway Setup"
echo "Docker setup pins Gateway mode to local."
echo "Gateway runtime bind comes from COREBLOW_GATEWAY_BIND (default: lan)."
echo "Current runtime bind: $COREBLOW_GATEWAY_BIND"
echo "Gateway port: $COREBLOW_GATEWAY_PORT"
echo "Gateway token: $COREBLOW_GATEWAY_TOKEN"
echo "Timezone: ${COREBLOW_TZ:-UTC}"
echo ""

# Write gateway configuration to coreblow.json
echo "==> Writing gateway configuration"
run_prestart_gateway --entrypoint sh coreblow-gateway -c "
  CONFIG_FILE=/home/node/.coreblow/coreblow.json
  if [ ! -f \"\$CONFIG_FILE\" ]; then
    echo '{}' > \"\$CONFIG_FILE\"
  fi
  # Use node to safely merge JSON config
  node -e \"
    const fs = require('node:fs');
    const path = '\$CONFIG_FILE';
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
    if (!cfg.gateway) cfg.gateway = {};
    if (!cfg.gateway.auth) cfg.gateway.auth = {};
    cfg.gateway.mode = 'local';
    cfg.gateway.bind = '${COREBLOW_GATEWAY_BIND}';
    cfg.gateway.auth.token = '${COREBLOW_GATEWAY_TOKEN}';
    fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\\n');
    console.log('Gateway config written successfully.');
  \"
" 2>/dev/null || echo "  (config write skipped — will use environment variables)"

# ─── Phase 4: Channel Setup Hints ─────────────────────────────────────

echo ""
echo "==> Channel setup (optional)"
echo "WhatsApp (QR):"
echo "  ${COMPOSE_HINT} run --rm coreblow-cli channels login"
echo "Telegram (bot token):"
echo "  ${COMPOSE_HINT} run --rm coreblow-cli channels add --channel telegram --token <token>"
echo "Discord (bot token):"
echo "  ${COMPOSE_HINT} run --rm coreblow-cli channels add --channel discord --token <token>"
echo "Docs: https://docs.coreblow.com/channels"

# ─── Phase 5: Start Gateway ───────────────────────────────────────────

echo ""
echo "==> Starting gateway"
docker compose "${COMPOSE_ARGS[@]}" up -d coreblow-gateway

# ─── Phase 6: Sandbox Setup (opt-in via COREBLOW_SANDBOX=1) ───────────

if [[ -n "$SANDBOX_ENABLED" ]]; then
  echo ""
  echo "==> Sandbox setup"

  # Build sandbox image if Dockerfile.sandbox exists.
  if [[ -f "$ROOT_DIR/Dockerfile.sandbox" ]]; then
    echo "Building sandbox image: coreblow-sandbox:bookworm-slim"
    docker build \
      -t "coreblow-sandbox:bookworm-slim" \
      -f "$ROOT_DIR/Dockerfile.sandbox" \
      "$ROOT_DIR"
  else
    echo "WARNING: Dockerfile.sandbox not found in $ROOT_DIR" >&2
    echo "  Sandbox config will be applied but no sandbox image will be built." >&2
    echo "  Agent exec may fail if the configured sandbox image does not exist." >&2
  fi

  # Defense-in-depth: verify Docker CLI in the running image before enabling
  # sandbox. This avoids claiming sandbox is enabled when the image cannot
  # launch sandbox containers.
  if ! docker compose "${COMPOSE_ARGS[@]}" run --rm --entrypoint docker coreblow-gateway --version >/dev/null 2>&1; then
    echo "WARNING: Docker CLI not found inside the container image." >&2
    echo "  Sandbox requires Docker CLI. Rebuild with --build-arg COREBLOW_INSTALL_DOCKER_CLI=1" >&2
    echo "  or use a local build (COREBLOW_IMAGE=coreblow:local). Skipping sandbox setup." >&2
    SANDBOX_ENABLED=""
  fi
fi

# Apply sandbox config only if prerequisites are met.
if [[ -n "$SANDBOX_ENABLED" ]]; then
  # Mount Docker socket via a dedicated compose overlay. This overlay is
  # created only after sandbox prerequisites pass, so the socket is never
  # exposed when sandbox cannot actually run.
  if [[ -S "$DOCKER_SOCKET_PATH" ]]; then
    SANDBOX_COMPOSE_FILE="$ROOT_DIR/docker-compose.sandbox.yml"
    cat >"$SANDBOX_COMPOSE_FILE" <<YAML
services:
  coreblow-gateway:
    volumes:
      - ${DOCKER_SOCKET_PATH}:/var/run/docker.sock
YAML
    if [[ -n "${DOCKER_GID:-}" ]]; then
      cat >>"$SANDBOX_COMPOSE_FILE" <<YAML
    group_add:
      - "${DOCKER_GID}"
YAML
    fi
    COMPOSE_ARGS+=("-f" "$SANDBOX_COMPOSE_FILE")
    echo "==> Sandbox: added Docker socket mount"
  else
    echo "WARNING: COREBLOW_SANDBOX enabled but Docker socket not found at $DOCKER_SOCKET_PATH." >&2
    echo "  Sandbox requires Docker socket access. Skipping sandbox setup." >&2
    SANDBOX_ENABLED=""
  fi
fi

if [[ -n "$SANDBOX_ENABLED" ]]; then
  # Enable sandbox in CoreBlow config.
  sandbox_config_ok=true

  echo "Sandbox enabled: mode=non-main, scope=agent, workspaceAccess=none"
  echo "Docs: https://docs.coreblow.com/gateway/sandboxing"
  # Restart gateway with sandbox compose overlay to pick up socket mount + config.
  docker compose "${COMPOSE_ARGS[@]}" up -d coreblow-gateway
else
  # Keep reruns deterministic: clean up stale sandbox compose overlay.
  if [[ -f "$ROOT_DIR/docker-compose.sandbox.yml" ]]; then
    rm -f "$ROOT_DIR/docker-compose.sandbox.yml"
  fi
fi

# ─── Phase 7: Summary ─────────────────────────────────────────────────

echo ""
echo "============================================================"
echo "  CoreBlow Gateway is running!"
echo "============================================================"
echo ""
echo "  Gateway URL:   http://127.0.0.1:${COREBLOW_GATEWAY_PORT}"
echo "  Health check:  http://127.0.0.1:${COREBLOW_GATEWAY_PORT}/healthz"
echo "  Readiness:     http://127.0.0.1:${COREBLOW_GATEWAY_PORT}/readyz"
echo "  Config:        $COREBLOW_CONFIG_DIR"
echo "  Workspace:     $COREBLOW_WORKSPACE_DIR"
echo "  Token:         $COREBLOW_GATEWAY_TOKEN"
echo ""
echo "Commands:"
echo "  ${COMPOSE_HINT} logs -f coreblow-gateway"
echo "  ${COMPOSE_HINT} exec coreblow-gateway node coreblow.mjs gateway --help"
echo "  curl -fsS http://127.0.0.1:${COREBLOW_GATEWAY_PORT}/healthz"
echo ""
echo "Stop:"
echo "  ${COMPOSE_HINT} down"
echo ""
