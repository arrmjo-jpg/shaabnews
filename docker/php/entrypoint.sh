#!/bin/sh
set -e

# Per-container boot for the Laravel image (php-fpm / workers / scheduler). Does NOT cache
# config/routes/views — that would need to happen against the RUNTIME env (secrets/URLs come from
# Coolify at container start, not build time), and enabling it deserves its own deliberate check
# (env() usage outside config/*.php, route/view compilation) rather than being turned on here.
# Only links public storage on the API role. DB migrations are a DEPLOY step (run once, not
# per-container) — see DEPLOYMENT.md.



# storage symlink (idempotent) — only meaningful for the php-fpm/API container, harmless elsewhere.
php artisan storage:link 2>/dev/null || true

exec "$@"
