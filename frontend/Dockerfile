# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies. Cache mount: persists npm's download cache across builds independently
# of the layer cache, so a package-lock.json bump only re-downloads the changed packages instead
# of everything.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,id=alphacms-frontend-npm npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Accept build args to bake them into the build if needed (like CLIENT)
ARG CLIENT=shaabjo
ENV CLIENT=$CLIENT

# Prevent Coolify's --build-arg injection from leaking API urls into the build.
# Next.js must NOT attempt API calls during static page generation at build time.
ENV API_BASE_URL=""
ENV SITE_URL="http://localhost:3000"

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# su-exec lets the entrypoint drop from root to nextjs after fixing volume ownership
RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Pre-create the cache dir owned by nextjs so a freshly created named volume
# (frontend-cache -> /app/.next/cache) inherits nextjs ownership on first mount.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Entrypoint re-asserts cache ownership at runtime (handles a pre-existing root-owned
# volume), then execs the server as the unprivileged nextjs user — never as root.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
