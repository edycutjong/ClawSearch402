FROM node:22-alpine AS base

FROM base AS builder
WORKDIR /app
# Install dependencies from root to respect monorepo workspaces
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/proxy/package.json ./apps/proxy/
COPY clients/node/package.json ./clients/node/
RUN npm ci

# Copy the rest of the frontend source
COPY apps/dashboard ./apps/dashboard
WORKDIR /app/apps/dashboard
# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
# Automatically leverage output traces to reduce image size
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
