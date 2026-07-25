# AlphaCMS — Reels Domain Engineering Skill

> Single source of truth for the **Reels** domain (short vertical video). Frontend,
> mobile, and backend engineers (and AI agents) should integrate without
> reverse-engineering code. Everything here reflects the **actual implementation**
> (verified by tests). News, WordPress migration, and unrelated work are out of scope.

Public endpoints are prefixed `/api/v1/{locale}` where `locale ∈ {ar, en}` (route-constrained).
Success envelope: `{ "data": ..., "meta": ... }`; errors: `{ "success": false, "message": ..., "errors": ... }`.

---

## A) Domain Overview

A **Reel** is a standalone short vertical-video content type (not tied to news Categories).
It reuses platform infrastructure: `media_assets` (the video + transcoded artifacts),
the unified polymorphic engagement model, and native SEO columns.

- **Public surfaces** (read-only, cached, single-flight, CDN-aware): reels feed, reel detail,
  featured reels, trending reels, search (basic), 301 redirects, reels sitemap.
- **Admin surfaces** (RBAC-guarded): reel CRUD, publish lifecycle (with a "ready media"
  publish safeguard), scheduled publishing, media attachment, revisions.

Supported workflows: draft → scheduled → published (+ archived / soft-delete / restore),
automatic scheduled publishing (`reels:publish-due`), featured promotion, translation linking
via `translation_group` (hreflang).

---

## B) Public API Architecture

| Endpoint | Purpose | Pagination | Cache (single-flight) |
|---|---|---|---|
| `GET /{locale}/reels` | Reels feed (filter `q`, sort `-published_at`) | offset (default) / `?paginate=cursor` | `feed(locale)`, REALTIME |
| `GET /{locale}/reels/featured` | Featured reels (`is_featured`) | none (`?per_page`) | `feed(locale)`, REALTIME |
| `GET /{locale}/reels/trending` | Trending (weighted engagement) | none (`?per_page`) | `feed(locale)`, REALTIME |
| `GET /{locale}/reels/{slug}` | Reel detail (full SEO + playback) | — | `detail(locale,slug)`, REALTIME |
| `GET /{locale}/redirects/reels?path=` | 301 resolver for old canonical paths | — | — |

**Caching:** all hot reads use **single-flight** (`CachedRead`) — one request rebuilds a key;
concurrent requests block briefly then read the warm value; lock timeout → direct compute (no
stampede, no deadlock). Cached `null` (detail 404) is distinguished from a miss. Requires a
tag-capable store (**Redis in production**, enforced by `RedisProductionCheck`).

**Invalidation (granular):** `ReelCacheTags` — a reel write flushes `feed(locale)` +
`detail(locale,slug)` (+ old equivalents on slug/locale change). The reels **sitemap** is tagged
`feed(locale)` and busts on any reel write.

**Detail payload** (`PublicReelResource`): `id, locale, title, slug, description, duration_seconds,
is_featured, published_at, canonical_path, share_image, seo {…}, metrics {…}, media {…}`.
Old slug/locale → **301** to the current reel URL. Unknown slug → 404.

**Search:** `filter[q]` is currently a DB `LIKE` over title/description (see §I — Meilisearch
deferred). Trending uses a real weighted engagement score.

**CDN:** HLS manifests/segments/posters/renditions are immutable (long cache). Feed/detail API
responses use the gateway default TTL; `ReelCdnPurge` actively purges reel pages + API on write
(gated on `cdn_auto_purge`, queued, fail-safe).

---

## C) Mobile App Integration Guide (mandatory)

| Screen | Endpoint |
|---|---|
| Reels feed (infinite scroll) | `GET /{locale}/reels?paginate=cursor&per_page=10` |
| Featured rail | `GET /{locale}/reels/featured?per_page=10` |
| Trending rail | `GET /{locale}/reels/trending?per_page=10` |
| Reel detail | `GET /{locale}/reels/{slug}` |

**Cursor vs offset:** **Use cursor (`?paginate=cursor`) for the feed** — it returns
`meta.cursor = { next_cursor, prev_cursor, has_more, per_page }`. Pass `?cursor={next_cursor}` for
the next page. Stable `published_at,id` ordering; no `COUNT`, no drift when new reels publish
mid-scroll. Offset (default, returns `meta.pagination`) is for non-scroll uses.

**HLS playback:** `data.media.hls` is the master playlist (adaptive 360/480/720/1080). Prefer HLS
for streaming; `data.media.renditions` provides progressive MP4 fallbacks. `data.media.poster` is
the still frame; `share_image` mirrors it. `data.media.processing_status` tells you if the video is
`ready` (only `ready` reels are public, so it will be `ready`).

**Prefetch strategy:** prefetch the next 1–2 reels' poster + HLS master while the current plays.
Posters are tiny and immutable — safe to cache aggressively. HLS segments are immutable.

**Caching expectations:** respect `Cache-Control` (`s-maxage` + `stale-while-revalidate`). Feed
responses are short-lived (REALTIME ~60s edge-cached); media artifacts are immutable. A small
client memory cache keyed by URL is safe.

**Engagement integration:** use the unified engagement endpoints (`/api/v1/engagement/reel/{id}/…`
— react / favorite; view is recorded automatically on detail fetch with a 30-min per-actor dedup).
Read counts from `data.metrics`.

**Trending consumption:** poll `/reels/trending` for a "hot now" rail (7-day-equivalent weighting;
short TTL — safe to poll).

**Playback lifecycle:** detail fetch auto-records a view (deduped). No explicit view ping needed.

---

## D) React Web Guide

- **Feed rendering:** `GET /{locale}/reels` (offset for SEO-paginated pages, cursor for client
  "load more"). Render a vertical-video grid/stage using `media.poster` as the placeholder.
- **Playback:** use an HLS-capable player (`media.hls`); fall back to `media.renditions` MP4.
- **SEO (SSR):** consume `data.seo` to populate `<head>`: `canonical_url`, `og.*` (type
  `video.other`, video URL, poster), `twitter.*`, `hreflang[]` (+ `x-default`), and
  `structured_data` (**VideoObject** JSON-LD) + emit as `<script type="application/ld+json">`.
- **Sharing:** `share_image` (poster) + OG/Twitter give correct share previews.
- **Routes:** canonical is `/{locale}/reels/{id}-{slug}`. Honor **301s** from the API for old
  slugs (and use `/redirects/reels?path=` for full old-path resolution in a catch-all).
- **Cache:** edge is actively purged on reel writes; SSR caches can be aggressive.

---

## E) Media Pipeline

- **Upload/ingest:** `StoreMediaAssetAction` — MIME sniffing validation (`StoreMediaAssetRequest`),
  size/dimension limits, SHA-256 dedupe, fail-loud guard on failed `storeAs`. Source is **streamed**
  to a temp file (memory-safe for large videos). **Not resumable** (see §I).
- **Transcode:** `TranscodeVideoAssetJob` + `VideoTranscoder` — single-pass adaptive ladder
  **1080/720/480/360** (CRF + bitrate per tier, source-height-aware), poster (JPG) + WebP thumb,
  ffprobe metadata (duration/width/height). `ShouldBeUnique`, `tries=2`, timeout + `failOnTimeout`,
  backoff, idempotent; routed to the `redis-media` queue connection.
- **HLS:** master + variant playlists + segments under `assets/{uuid}/hls/`; single-origin delivery
  (`MediaDeliveryResolver`) keeps relative segment paths valid; immutable cache headers; new UUID on
  re-transcode prevents stale.
- **Failure states:** `processing_status` (queued → processing → ready/failed); failure reason in
  `metadata.processing_error`; stuck/failed surfaced by `MediaProcessingHealthCheck`.

---

## F) Storage / Delivery

Reels **fully** inherit the hybrid media architecture:
- **Local canonical** (`uploads`) + **remote R2 mirror** (`MirrorMediaToRemoteJob`, streamed,
  idempotent, immutable Cache-Control).
- **Delivery resolver** chooses one origin per asset (local-first; remote when enabled+healthy+synced;
  legacy remote-only always remote) — HLS integrity preserved.
- **Sync/verify/repair:** `media:sync:remote`, `media:verify:remote`, `media:repair:remote --pull`.
- **Dual delete:** `MediaFileCleaner` removes local + remote, fail-isolated.
- **Health:** `RemoteStorageHealthCheck`; disk rebuilt from settings per job (`configureDisk`).

---

## G) Engagement Model

- Polymorphic `engagement_counters` (`likes`, `dislikes`, `favorites`, `views`) shared with articles.
- **Views:** recorded on detail fetch via `EngagementService::recordViewFor` — atomic increment,
  **30-min per-actor dedup**, throttled write routes.
- **Trending score:** `views·1 + likes·4 + favorites·6 − dislikes·2`, recency tiebreak.
- **Caveats (deferred — see §I):** single hot counter row per reel (viral contention) and
  views have no durable backstop/reconciliation (cache-dedup + counter only).

---

## H) Operations

- **Health checks:** `MediaProcessingHealthCheck` (stuck/failed transcodes), `RemoteStorageHealthCheck`,
  `SchedulerHealthCheck`, `RedisProductionCheck` — all surfaced at `/admin/system/health` + Ops Overview.
- **Failed jobs:** admin tooling (`/admin/system/failed-jobs`) lists/retries/clears failed transcode
  & mirror jobs.
- **Transcode diagnostics:** `processing_status` + `metadata.processing_error`; reel admin resource
  exposes `processing_status`; manual reprocess available.
- **Commands:** `reels:publish-due` (cron, idempotent), `media:sync:remote`, `media:verify:remote`,
  `media:repair:remote --pull`.
- **Remote recovery:** save valid R2 creds → `php artisan queue:restart` → `media:sync:remote`.
  Search (if enabled later): `scout:sync-index-settings` + `scout:import`.
- **CDN purge:** automatic via `ReelCdnPurge` on every reel write.

---

## I) Deferred Scope (honest)

| Feature | State | Notes |
|---|---|---|
| **Meilisearch reel search** | **Deferred.** | Reel `filter[q]` is a DB `LIKE` over title/description; `Reel` is **not** `Searchable`. The article search path (Scout/Meili) is the reference if/when reels need relevance + typo tolerance. |
| **Resumable upload** | **Deferred.** | Single multipart upload; memory-safe (streamed) but not chunked/tus. Acceptable for admin-uploaded reels; revisit if large/user uploads are introduced. |
| **Engagement viral scaling** | **Deferred.** | Single counter row per reel + cache-dedup views (no durable backstop/reconciliation) — same platform-wide caveat as news. Buffer/shard + reconciliation job is the future fix. |
| **Most-read reels** | **Deferred.** | Trending (weighted) exists; a pure most-viewed endpoint is not implemented (mirror the article `most-read` action if needed). |
| **Admin artifact-readiness UI** | **Deferred.** | Operators see `processing_status`; a per-rendition/HLS readiness panel is not built. |
| **Differentiated CDN TTL tiers for reels** | **Deferred (polish).** | Reels use the gateway default TTL; HLS artifacts are already immutable. Mirror `CdnTtl` if per-content tiering is wanted. |
