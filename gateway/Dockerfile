FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile || npm ci
COPY . .
RUN npm run build 2>/dev/null || echo "No build step"

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 coreblow && adduser -u 1001 -G coreblow -s /bin/sh -D coreblow
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/extensions ./extensions
COPY --from=builder /app/locales ./locales
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/tsconfig.json ./
USER coreblow
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "--import", "tsx", "src/index.ts"]
