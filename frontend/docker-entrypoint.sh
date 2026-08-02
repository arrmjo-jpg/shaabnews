#!/bin/sh
set -e

# Next.js standalone's generated server.js binds to `process.env.HOSTNAME || '0.0.0.0'`
# (not HOST, which it never reads). Docker unconditionally sets HOSTNAME to the
# container's short ID for every container, so the '0.0.0.0' fallback never fires —
# the server ends up bound to whichever single network the hostname happens to resolve
# to on this container's /etc/hosts, not all interfaces. On a container attached to
# multiple Docker networks (this one is, for the Coolify proxy network + the app's own
# project network), that's frequently NOT the network the reverse proxy connects
# through, so it sees "connection refused" despite the app being perfectly healthy.
# Unsetting HOSTNAME here (before the server ever reads it) restores the intended
# 0.0.0.0 fallback so the app listens on every interface, matching every other
# service's nginx config in this stack.
unset HOSTNAME

# A named Docker volume is mounted at /app/.next/cache (Next.js ISR + fetch cache).
# On first creation that volume is owned by root and masks the image's nextjs-owned
# directory, so the unprivileged `nextjs` user gets EACCES when writing the cache.
# Fix ownership here on every start (idempotent + cheap), then drop to nextjs and run
# the server. The Node process therefore runs as nextjs, never as root.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/.next/cache
  chown -R nextjs:nodejs /app/.next/cache
  exec su-exec nextjs:nodejs "$@"
fi

# Already unprivileged (container started with a forced user) — just exec.
exec "$@"
