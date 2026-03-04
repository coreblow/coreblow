FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
COPY gateway/package.json gateway/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY gateway/tsconfig.json ./
COPY gateway/src/ ./src/

# Build TypeScript
RUN npx tsc

# --- Production stage ---
FROM node:22-slim

WORKDIR /app

# Install Python for Ultra Skills bridge (optional)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl && \
    rm -rf /var/lib/apt/lists/*

# Production dependencies only
COPY gateway/package.json gateway/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled JS
COPY --from=builder /app/dist/ ./dist/

# Create data directory
RUN mkdir -p /data/.coreblow/state /data/.coreblow/auth

ENV NODE_ENV=production
ENV COREBLOW_HOME=/data/.coreblow
ENV LOG_LEVEL=info

EXPOSE 3120

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3120/api/health || exit 1

CMD ["node", "dist/index.js", "gateway", "start"]
