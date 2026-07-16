#!/bin/sh
set -e

# Per-container boot for the Laravel image (php-fpm / workers / scheduler). Caches config/routes/
# views from the RUNTIME env (so secrets/URLs are correct), and links public storage on the API
# role. DB migrations are a DEPLOY step (run once, not per-container) — see DEPLOYMENT.md.



# storage symlink (idempotent) — only meaningful for the php-fpm/API container, harmless elsewhere.
php artisan storage:link 2>/dev/null || true

exec "$@"
