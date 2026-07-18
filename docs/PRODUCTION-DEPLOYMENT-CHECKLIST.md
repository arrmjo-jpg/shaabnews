# Production Deployment Checklist

Environment-configuration items that are correct for local development
but **must be verified/changed** before this codebase is deployed to a
real production environment. Compiled from the 2026-07-18 full-stack
health audit and the URL-migration/sitemap fix work. Every line below
is sourced from an actual value read from the running local
environment (`docker exec ... env`), not assumed.

## Must change before go-live

- [ ] **`APP_DEBUG`** — currently `true`. Must be `false` in
      production; leaving it `true` renders full stack traces, file
      paths, and query details on any unhandled exception.
- [ ] **`APP_ENV`** — currently `local`. Must be `production`.
- [ ] **`SITE_URL` (frontend container)** — currently
      `http://localhost:8080` (the backend's own port). Must be the
      real public frontend domain. Confirmed root cause of wrong-origin
      canonical/OpenGraph tags on 4 of 7 page types tested (homepage,
      category, search, author) — traced to `frontend/src/lib/env.ts`
      reading `process.env.SITE_URL`.
- [ ] **`SITE_URL` (backend)** — currently `http://localhost:8080`
      (same as `APP_URL`). Confirm this should be the public site
      domain, not the API domain, before launch — check every
      consumer (`SitemapController`, `PublicSeoBuilder`) agrees on
      which env var means "the public frontend" vs "this API."
- [ ] **`FRONTEND_URL` (backend)** — currently correctly
      `http://localhost:3000` for local dev; must be the real
      production frontend domain.
- [ ] **`CDN_ENABLED` / `cdn_auto_purge`** — currently `false`/`false`
      (CDN purging fully disabled). **Before enabling CDN in any
      environment**, first fix the `cdn-purge` queue worker gap below
      — otherwise every CDN purge job dispatched by content actions
      (create/update/delete/publish across Articles/Pages/Reels) will
      silently never run.
- [ ] **`LOG_LEVEL`** — currently `debug`. Recommend `error` or
      `warning` for production to avoid log noise/volume and reduce
      risk of sensitive data in logs.
- [ ] **Mail sender identity** — `MAIL_FROM_ADDRESS`/`MAIL_USERNAME`
      currently `test@lahzat-edrak.com`. Confirm this is intentional
      or replace with the real production sending identity before
      launch.

## Must fix before enabling CDN (not before this release, but before CDN goes live)

- [ ] **No worker consumes the `cdn-purge` / `cdn-purge:notify` Redis
      queues.** Confirmed: `app/Modules/CDN/Jobs/ProcessCdnPurgeBatch.php`
      is a real `ShouldQueue` job, dispatched from 14 real content
      actions (`ArticleCdnPurge`, `PageCdnPurge`, `ReelCdnPurge`, called
      from Create/Update/Delete/ForceDelete/Restore/PublishDue actions).
      It's currently dormant only because `CDN_ENABLED=false`. The
      moment CDN is enabled, every one of those dispatches will queue
      into `cdn-purge`, which nothing currently consumes — they will
      silently pile up forever, and CDN purging will not actually
      happen despite the app believing it has.
      Fix: add `cdn-purge` (and `cdn-purge:notify` if also real) to a
      worker's `--queue` list in `docker-compose.yml`. Do not remove
      the `QueueCheck` monitoring for this queue — it correctly caught
      this gap.

## Operational items — not release blockers, but should be tracked

- [ ] **Backups have never succeeded** (`php artisan backup:list` →
      0 backups, 0 KB). `health:check` confirms:
      `Scheduler Health: Failed — backups_run/backups_monitor last run
      failed`. No `BACKUP_*` env vars are set (defaults to `local`
      disk). Needs investigation before this environment holds
      anything irreplaceable.
- [ ] **Epaper search index stale** — 0 docs indexed vs. 2 published
      epapers in the DB. Fix already named by the health check itself:
      `php artisan epaper:search-reindex --fresh`.
- [ ] **MySQL slow query log disabled** despite 24 recorded slow
      queries (`Slow_queries` status counter). Enable
      `slow_query_log` to identify which queries.
- [ ] **One missing avatar file** — author id=2's avatar
      (`storage/avatars/868105b8-...png`) 404s; storage/symlink
      infrastructure itself is otherwise healthy (3 other avatars
      verified working).
- [ ] **`legacy-db` container fails to start** — bind-mount target
      `database/shaab.sql` is an empty directory on the host, not the
      expected SQL file. No other service depends on this container.
- [ ] **Homepage cold-start cache poisoning after a fresh frontend
      restart** — the very first request to a freshly restarted
      frontend container can render with empty feed sections, which
      then gets cached as if valid. A warm-up request or restart
      resolves it, but the homepage should not cache an empty render
      in the first place. Tracked separately per prior agreement.
- [ ] **`Sitemap::add()` O(n²) cost at scale** (~62–70s full
      regeneration at 50,000 articles, cached so not a per-request
      cost). See `docs/architecture/SITEMAP-GENERATION-PERFORMANCE.md`
      and the linked GitHub issue.

## Already verified healthy (no action needed)

- MySQL connectivity, Redis connectivity, Meilisearch health + a real
  search query returning real results.
- All 7 public page types tested return HTTP 200 with OpenGraph tags
  present.
- `.env` not exposed via HTTP, `/telescope` and `/horizon` not exposed
  (404 — Horizon isn't even installed), `/fpm-status` returns 403.
- Legacy redirect routes (`/articles/{id}`, `/category/{slug}`) still
  correctly 308 to the new canonical URLs.
