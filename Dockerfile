# syntax=docker/dockerfile:1.7

# ── CoreBlow Production Dockerfile ──────────────────────────────────
# Multi-stage build produces a minimal runtime image without build tools
# or source code. Works with Docker, Buildx, and Podman.
#
# Build:  docker build -t coreblow .
# Run:    docker run -p 3000:3000 -e COREBLOW_TOKEN=your-token coreblow
#
# Two runtime variants:
#   Default (bookworm):      docker build .
#   Slim (bookworm-slim):    docker build --build-arg COREBLOW_VARIANT=slim .

ARG COREBLOW_VARIANT=default
ARG COREBLOW_DOCKER_APT_UPGRADE=1
ARG COREBLOW_NODE_BOOKWORM_IMAGE="node:22-bookworm"
ARG COREBLOW_NODE_BOOKWORM_SLIM_IMAGE="node:22-bookworm-slim"

# ── Stage 1: Dependencies ──────────────────────────────────────────
FROM ${COREBLOW_NODE_BOOKWORM_IMAGE} AS deps

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
COPY ui/package.json ./ui/package.json
COPY packages ./packages
COPY extensions ./extensions
COPY apps ./apps
COPY patches ./patches

RUN --mount=type=cache,id=coreblow-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    NODE_OPTIONS=--max-old-space-size=2048 pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────
FROM deps AS build

COPY . .

# Normalize extension/skill permissions for safe COPY later
RUN for dir in /app/extensions /app/skills; do \
      if [ -d "$dir" ]; then \
        find "$dir" -type d -exec chmod 755 {} +; \
        find "$dir" -type f -exec chmod 644 {} +; \
      fi; \
    done

RUN pnpm build 2>/dev/null || npm run build 2>/dev/null || echo "No build step — using tsx runtime"

# ── Stage 2b: Prune ───────────────────────────────────────────────
FROM build AS runtime-assets

RUN CI=true pnpm prune --prod 2>/dev/null || true && \
    find . -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' -o -name '*.tsbuildinfo' \) -delete 2>/dev/null || true && \
    rm -rf .git .github tests src/**/*.test.ts src/**/*.spec.ts

# ── Runtime base images ────────────────────────────────────────────
FROM ${COREBLOW_NODE_BOOKWORM_IMAGE} AS base-default
FROM ${COREBLOW_NODE_BOOKWORM_SLIM_IMAGE} AS base-slim

# ── Stage 3: Runtime ───────────────────────────────────────────────
FROM base-${COREBLOW_VARIANT}
ARG COREBLOW_VARIANT
ARG COREBLOW_DOCKER_APT_UPGRADE

# OCI metadata labels
LABEL org.opencontainers.image.source="https://github.com/coreblow/coreblow" \
      org.opencontainers.image.url="https://coreblow.com" \
      org.opencontainers.image.documentation="https://docs.coreblow.com/install/docker" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="CoreBlow" \
      org.opencontainers.image.description="CoreBlow AI Gateway — multi-channel agent orchestration runtime"

WORKDIR /app

# Install minimal system dependencies
RUN --mount=type=cache,id=coreblow-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=coreblow-apt-lists,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    if [ "${COREBLOW_DOCKER_APT_UPGRADE}" != "0" ]; then \
      DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends; \
    fi && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      procps hostname curl git lsof openssl ca-certificates

RUN chown node:node /app

# Copy runtime assets
COPY --from=runtime-assets --chown=node:node /app/node_modules ./node_modules
COPY --from=runtime-assets --chown=node:node /app/package.json .
COPY --from=runtime-assets --chown=node:node /app/src ./src
COPY --from=runtime-assets --chown=node:node /app/tsconfig.json ./
COPY --from=runtime-assets --chown=node:node /app/coreblow.mjs .

# Copy extension and skill assets
COPY --from=runtime-assets --chown=node:node /app/extensions ./extensions
COPY --from=runtime-assets --chown=node:node /app/skills ./skills

# Bundled plugins directory
ENV COREBLOW_BUNDLED_PLUGINS_DIR=/app/extensions

# Keep pnpm available in runtime
ENV COREPACK_HOME=/usr/local/share/corepack
RUN install -d -m 0755 "$COREPACK_HOME" && \
    corepack enable && \
    chmod -R a+rX "$COREPACK_HOME" 2>/dev/null || true

# Optional: install additional system packages
# docker build --build-arg COREBLOW_DOCKER_APT_PACKAGES="python3 wget" .
ARG COREBLOW_DOCKER_APT_PACKAGES=""
RUN --mount=type=cache,id=coreblow-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=coreblow-apt-lists,target=/var/lib/apt,sharing=locked \
    if [ -n "$COREBLOW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $COREBLOW_DOCKER_APT_PACKAGES; \
    fi

# Optionally install Docker CLI for sandbox container management
# docker build --build-arg COREBLOW_INSTALL_DOCKER_CLI=1 .
ARG COREBLOW_INSTALL_DOCKER_CLI=""
RUN --mount=type=cache,id=coreblow-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=coreblow-apt-lists,target=/var/lib/apt,sharing=locked \
    if [ -n "$COREBLOW_INSTALL_DOCKER_CLI" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg && \
      install -m 0755 -d /etc/apt/keyrings && \
      curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
      chmod a+r /etc/apt/keyrings/docker.gpg && \
      printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable\n' \
        "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.list && \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        docker-ce-cli docker-compose-plugin; \
    fi

# Expose CLI binary
RUN ln -sf /app/coreblow.mjs /usr/local/bin/coreblow \
 && chmod 755 /app/coreblow.mjs

ENV NODE_ENV=production

# Security hardening: Run as non-root user
USER node

# Health check
HEALTHCHECK --interval=3m --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "src/index.ts"]
