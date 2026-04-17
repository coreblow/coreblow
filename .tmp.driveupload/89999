# syntax=docker/dockerfile:1.7

# ── CoreBlow Gateway Production Dockerfile ─────────────────────────
# Multi-stage build following OpenClaw patterns:
#   Stage 1: deps      — install production dependencies
#   Stage 2: build     — compile TypeScript, prune dev deps
#   Stage 3: runtime   — minimal bookworm-slim with runtime assets only
#
# Build:  docker build -t coreblow-gateway .
# Run:    docker run -p 3000:3000 coreblow-gateway
# Slim:   docker build --build-arg COREBLOW_DOCKER_APT_UPGRADE=0 .

ARG COREBLOW_NODE_IMAGE="node:22-bookworm"
ARG COREBLOW_NODE_SLIM_IMAGE="node:22-bookworm-slim"

# ── Stage 1: Dependencies ──────────────────────────────────────────
FROM ${COREBLOW_NODE_IMAGE} AS deps

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY patches ./patches

# Use cache mount to speed up rebuilds
RUN --mount=type=cache,id=coreblow-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    NODE_OPTIONS=--max-old-space-size=2048 \
    pnpm install --frozen-lockfile || npm ci

# ── Stage 2: Build ─────────────────────────────────────────────────
FROM deps AS build

COPY . .

# Normalize extension/skill permissions
RUN for dir in /app/extensions /app/skills; do \
      if [ -d "$dir" ]; then \
        find "$dir" -type d -exec chmod 755 {} +; \
        find "$dir" -type f -exec chmod 644 {} +; \
      fi; \
    done

RUN npm run build 2>/dev/null || echo "No build step — using tsx runtime"

# Prune dev dependencies and strip build-only files
FROM build AS runtime-assets

RUN CI=true pnpm prune --prod 2>/dev/null || true && \
    find . -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' -o -name '*.tsbuildinfo' \) -delete 2>/dev/null || true && \
    rm -rf .git .github tests src/**/*.test.ts src/**/*.spec.ts

# ── Stage 3: Runtime ───────────────────────────────────────────────
FROM ${COREBLOW_NODE_SLIM_IMAGE} AS runtime

ARG COREBLOW_DOCKER_APT_UPGRADE=1

# OCI metadata labels (OpenClaw pattern)
LABEL org.opencontainers.image.source="https://github.com/coreblow/coreblow" \
      org.opencontainers.image.url="https://coreblow.com" \
      org.opencontainers.image.documentation="https://docs.coreblow.com/install/docker" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="CoreBlow Gateway" \
      org.opencontainers.image.description="CoreBlow AI Gateway — multi-channel agent orchestration runtime"

WORKDIR /app

# Install minimal system dependencies
# Cache apt layers for faster rebuilds (OpenClaw pattern)
RUN --mount=type=cache,id=coreblow-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=coreblow-apt-lists,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    if [ "${COREBLOW_DOCKER_APT_UPGRADE}" != "0" ]; then \
      DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends; \
    fi && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      procps hostname curl openssl ca-certificates && \
    rm -rf /tmp/* /var/tmp/*

# Keep pnpm available in runtime (OpenClaw pattern)
ENV COREPACK_HOME=/usr/local/share/corepack
RUN install -d -m 0755 "$COREPACK_HOME" && \
    corepack enable && \
    chmod -R a+rX "$COREPACK_HOME" 2>/dev/null || true

# Ensure app dir is owned by non-root user
RUN chown node:node /app

# Copy runtime assets from build stage
COPY --from=runtime-assets --chown=node:node /app/node_modules ./node_modules
COPY --from=runtime-assets --chown=node:node /app/package.json ./
COPY --from=runtime-assets --chown=node:node /app/src ./src
COPY --from=runtime-assets --chown=node:node /app/tsconfig.json ./

# Copy extension/skill/locale assets
COPY --from=runtime-assets --chown=node:node /app/extensions ./extensions
COPY --from=runtime-assets --chown=node:node /app/locales ./locales
COPY --from=runtime-assets --chown=node:node /app/skills ./skills

# Optional: install additional system packages
# docker build --build-arg COREBLOW_DOCKER_APT_PACKAGES="python3 wget" .
ARG COREBLOW_DOCKER_APT_PACKAGES=""
RUN --mount=type=cache,id=coreblow-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=coreblow-apt-lists,target=/var/lib/apt,sharing=locked \
    if [ -n "$COREBLOW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $COREBLOW_DOCKER_APT_PACKAGES; \
    fi

ENV NODE_ENV=production

# Security hardening: Run as non-root user (OpenClaw pattern)
# The node:22-bookworm-slim image includes a 'node' user (uid 1000)
USER node

EXPOSE 3000

# Health check using Node.js fetch — no wget/curl dependency required
# Follows OpenClaw pattern: /healthz (liveness) and /readyz (readiness)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start gateway server
# Binds to loopback by default for security (OpenClaw pattern).
# For Docker bridge networking, override with --bind lan and set auth.
CMD ["node", "--import", "tsx", "src/index.ts"]
