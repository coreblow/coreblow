FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
RUN npm ci --production

FROM base AS builder
COPY package.json package-lock.json ./
COPY gateway/ ./gateway/
RUN cd gateway && npm ci && npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/gateway/dist ./dist
COPY --from=builder /app/gateway/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
