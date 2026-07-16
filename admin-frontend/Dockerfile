# syntax=docker/dockerfile:1
# =========================
# Deps Stage — isolated from build ARGs on purpose (see note below)
# =========================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,id=alphacms-admin-npm npm ci

# =========================
# Build Stage
# =========================
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments (Vite bakes these into the compiled JS at build time, so they can only be
# applied here — not earlier). Kept in a separate `builder` stage from `deps` on purpose: these
# values change per deploy/environment, and an ARG/ENV declared before `npm ci` would invalidate
# that layer's cache on every value change even though npm ci never reads them — that was exactly
# the bug in the previous single-stage version of this file (ARG/ENV came before COPY
# package*.json + npm ci, so a routine env change silently forced a full dependency reinstall).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_PUBLIC_SITE_URL
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL

RUN npm run build

# =========================
# Production Stage
# =========================
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
