# syntax=docker/dockerfile:1
FROM node:20.20.2-alpine AS base
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

# Build-time CMS endpoint. Deliberately named BUILD_API_BASE_URL rather than API_BASE_URL:
# Coolify injects API_BASE_URL as a --build-arg carrying the RUNTIME value (http://backend), which
# no build can resolve — BuildKit runs builds off the compose network. With no ARG of that name
# declared, the injection is ignored. That preserves exactly the protection the previous
# `ENV API_BASE_URL=""` provided, without the side effect that made every prerendered page generate
# with no data (all lib/* loaders guard on `if (!env.apiBaseUrl) return []`, so an empty value meant
# no fetch ran, no cache tag was attached, and revalidateTag() could never reach the artifact).
#
# No default value: a build that cannot reach the CMS must fail loudly, never silently ship empty
# HTML. The value is environment-specific (local / CI / Coolify / production); the name is not.
ARG BUILD_API_BASE_URL
ARG SITE_URL
ENV BUILD_API_BASE_URL=$BUILD_API_BASE_URL
ENV API_BASE_URL=$BUILD_API_BASE_URL
ENV SITE_URL=$SITE_URL

# Secrets are mounted, never passed as build args: --mount=type=secret exposes them only for the
# duration of this RUN and leaves no trace in image layers or `docker history`.
# `npm run build` is the gated pipeline (config assert -> API preflight -> next build -> artifact
# assert); see frontend/scripts/. The gates need the same secrets, so they run inside this mount.
RUN --mount=type=secret,id=openweather_api_key,env=OPENWEATHER_API_KEY \
    --mount=type=secret,id=internal_api_token,env=INTERNAL_API_TOKEN \
    npm run build

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
