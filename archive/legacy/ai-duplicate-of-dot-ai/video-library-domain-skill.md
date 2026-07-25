# AlphaCMS — Video Library Domain Engineering Skill

> Single source of truth for the **Video Library** domain (long-form / standard video — uploaded
> or external). Frontend, mobile, and backend engineers (and AI agents) should integrate without
> reverse-engineering code. Everything here reflects the **actual implementation** (verified by the
> Pest suite). News, Reels, and unrelated work are out of scope (see the sibling skills).

Public endpoints are prefixed `/api/v1/{locale}` where `locale ∈ {ar, en}` (route-constrained).
Admin endpoints are under `/api/v1/admin/*` (auth:sanctum + `abilities:admin` + active + role).
Success envelope: `{ "success": true, "message": ..., "data": ..., "meta": ... }`;
errors: `{ "success": false, "message": ..., "errors": ... }`.

---

## A) Domain Overview

A **Video** is a first-class standalone content type for long/standard video. Unlike Reels (short,
vertical, upload-only), a Video may be **uploaded** (owned `media_asset`, full HLS pipeline) **or
external** (YouTube / Vimeo / allow-listed direct MP4 — a shared library reference). It has its own
**hierarchical categories** and ordered **playlists**, and reuses platform infrastructure:
`media_assets`, the polymorphic engagement model, native SEO columns, `translation_group` (hreflang),
and the hybrid local+R2 storage.

- **Public surfaces** (read-only, cached, single-flight, CDN-aware): videos feed, detail, featured,
  trending, related, by-category, playlists index/detail, 301 redirects, video + playlist sitemaps.
- **Admin surfaces** (RBAC-guarded): video CRUD + lifecycle (ready-media publish safeguard),
  scheduled publishing, source management (upload/external with safe replacement), bulk actions,
  category tree CRUD + reorder, playlist CRUD + attach/detach/reorder, dashboard, **analytics**,
  **operations** (processing health + reprocess + publish queue).

Lifecycle: `draft → scheduled → published` (+ `archived`, soft-delete, restore, force-delete).
Automatic scheduled publishing via `videos:publish-due`. Visibility: `public / unlisted / private`.

---

## B) Architecture Decisions (the "why")

1. **Separate domain, mirrored conventions — not a fork of Reels.** Videos reuse the *patterns*
   (thin controllers → single-purpose Actions → `ApiResponse`, Spatie QueryBuilder allow-lists,
   granular cache tags, RBAC middleware) but are an independent domain with their own tables,
   resources, permissions, categories and playlists. No shared base class with Reels.
2. **Source ownership model is explicit.** *Uploaded* assets are **owned** (one `media_asset`, enters
   the standard HLS pipeline); *external* sources are **shared library references** (resolved
   server-side). A video **always has a source** (required even for drafts). There is **no "detach
   source"** — only an explicit, confirmed **replace**. The frontend UX never implies unsafe
   detach/replace semantics (ownership-accurate confirmation text).
3. **Readiness is enforced only at publish/schedule.** A draft may hold a still-processing upload.
   `hasPublishableMedia()` (external = ready once linked; uploaded = `processing_status === ready`)
   gates `published`/`scheduled` in both manual transition and the scheduler — never on draft save.
4. **Standard media profile (no `reel` profile).** Uploaded videos use the **default** HLS+poster
   ladder with the larger standard upload budget (`performance.media.video_max_kb`), distinct from
   Reels' short **vertical** profile (`reel_video_max_kb`, vertical renditions). No `reel` profile is
   applied to library videos.
5. **Partial-success bulk.** Bulk operations process valid items and skip invalid ones with a reason;
   only a missing per-op permission fails the whole request (403). Per-op abilities are enforced in
   the Action (coarse `videos.edit` gate on the route).
6. **Analytics/Operations are backed by real aggregates only.** No fabricated charts. Analytics is
   `engagement_counters` aggregates + weighted trending + top playlists; the dashboard supplies
   source/status distributions + top videos/categories. Operations exposes real processing health,
   a failed/processing needs-attention list, and the publish queue.
7. **Frontend mirrors the platform SPA architecture.** Feature folder
   (`features/video-library/{pages,components,hooks}`), per-resource services on the shared `http`
   client, React Query with a single `['video-library']` invalidation namespace, `react-i18next`
   per-feature namespace (ar default/RTL + en), `borderRadius: 0` design system. No parallel
   architecture, no DnD library (up/down reorder matches the news category convention).

---

## C) Admin API Surface (`/api/v1/admin`)

Coarse route gate in **bold**; finer per-op abilities (where applicable) noted.

### Videos — `prefix videos`
| Method & path | Action | Permission |
|---|---|---|
| `GET /videos` | list (filter/sort/trashed) | **videos.view** |
| `GET /videos/stats` | status/processing KPI counters | **videos.view** |
| `GET /videos/dashboard` | dashboard aggregates | **videos.view** |
| `GET /videos/analytics` | engagement aggregates + trending + top playlists | **videos.view** |
| `GET /videos/operations` | processing health + needs-attention + publish queue | **videos.view** |
| `POST /videos/bulk` | partial-success bulk | **videos.edit** (+ per-op: publish→`videos.publish`, delete→`videos.delete`, add_to_playlist→`video-playlists.manage`; feature/unpublish/move_category within edit) |
| `POST /videos` | create (source required) | **videos.create** |
| `GET /videos/{video}` | show | **videos.view** |
| `GET /videos/{video}/analytics` | per-video analytics (range `24h/7d/30d/custom`; forward-only trends + traffic + distribution + URL/publish history; watch metrics **deferred**) | **videos.view** |
| `PUT /videos/{video}` | update (source optional) | **videos.edit** |
| `PATCH /videos/{video}/status` | transition | **videos.edit** (+ publish/schedule→`videos.publish`, archive→`videos.archive`) |
| `POST /videos/{video}/reprocess` | re-queue HLS (uploaded only) | **videos.reprocess** |
| `DELETE /videos/{video}` | soft delete | **videos.delete** |
| `POST /videos/{video}/restore` | restore | **videos.restore** |
| `DELETE /videos/{video}/force` | force delete | **videos.force_delete** |

**List filters** (Spatie, unknown filter → 400): `filter[status|visibility|locale|source_type|is_featured|video_category_id|author_id]` (exact), `filter[title]` (partial). **Sorts:** `id,title,created_at,published_at,views_count,sort_order` (default `-created_at`). **Trashed:** `?trashed=only|with`. **Pagination meta:** `{ total, count, per_page, current_page, total_pages }`.

**Bulk actions:** `publish | unpublish | feature(value:bool) | move_category(video_category_id: present, nullable) | add_to_playlist(playlist_id) | delete`. Result: `{ action, requested, processed, skipped:[{id,reason}] }` (reasons: `not_found, already_in_state, media_not_ready, already_in_playlist`).

### Video Categories — `prefix video-categories`
`GET /` (tree, **video-categories.view**), `POST /`, `PUT /{id}`, `PATCH /{id}/move {direction:up|down}`, `DELETE /{id}`, `POST /{id}/restore`, `DELETE /{id}/force` — all mutations **video-categories.manage**. Hierarchy: max depth 3; circular prevention (can't parent under self/descendant); can't delete a node with children.

### Playlists — `prefix video-playlists`
`GET /` (**video-playlists.view**), `POST /`, `PUT /{id}`, `DELETE /{id}`, restore/force, `POST /{id}/videos {video_ids[]}` (attach, dup-safe), `DELETE /{id}/videos/{video}` (detach), `PATCH /{id}/reorder {ordered_ids[]}` — all mutations **video-playlists.manage**. Videos ordered by pivot `position`.

---

## D) Public API Architecture (`/api/v1/{locale}`)

| Endpoint | Purpose |
|---|---|
| `GET /{locale}/videos` | feed (filter `q` → **Scout/Meilisearch**, sort `-published_at`) |
| `GET /{locale}/videos/featured` | featured videos |
| `GET /{locale}/videos/trending` | weighted-engagement trending |
| `GET /{locale}/videos/{slug}` | detail (full SEO + playback; auto view-record via beacon) |
| `GET /{locale}/videos/{slug}/related` | related videos |
| `GET /{locale}/video-categories/{slug}` | videos in a category |
| `GET /{locale}/playlists` · `/playlists/{slug}` | playlist index / detail |
| `GET /{locale}/redirects/videos?path=` · `/redirects/playlists?path=` | 301 resolvers for old canonical paths |

Public reads expose only `published + playable` (and `public` for lists; `unlisted` openable by direct
slug). All hot reads are single-flight cached (Redis tag store in production) and CDN-aware. Public
video **search uses Scout** (unlike Reels' DB LIKE) — relevance + typo tolerance.

---

## E) Permissions Map

| Permission | Grants |
|---|---|
| `videos.view` | list/detail/stats/dashboard/analytics/operations |
| `videos.create` | create video |
| `videos.edit` | update + status route gate + bulk route gate |
| `videos.publish` | publish / schedule (manual + bulk) |
| `videos.archive` | archive transition |
| `videos.delete` | soft delete (+ bulk delete) |
| `videos.restore` | restore from trash |
| `videos.force_delete` | permanent delete |
| `videos.reprocess` | re-queue HLS for uploaded media |
| `videos.sync` | **reserved** — remote-asset mirror sync; provisioned in the seeder, **not yet wired to a route/command** (future remote-storage tooling) |
| `video-categories.view` / `.manage` | category tree read / all mutations |
| `video-playlists.view` / `.manage` | playlist read / all mutations + attach/detach/reorder |

Frontend gating mirrors this exactly (e.g., the Operations *Reprocess* button renders only with
`videos.reprocess`; bulk *add-to-playlist* only with `video-playlists.manage`).

---

## F) Media Pipeline & Source Model

- **Uploaded:** `mediaLibraryService.upload` → `media_assets` (kind `video`) → `TranscodeVideoAssetJob`
  (standard ladder 1080/720/480/360 + poster + WebP thumb, ffprobe metadata), `redis-media` queue.
  `processing_status: queued → processing → ready/failed`. The admin form polls until ready/failed.
- **External:** `media/external/resolve` previews (throttled); the asset (kind `external`, with
  `embed_url`/`provider`) is created server-side on save via `VideoMedia::attachExternalSource`.
  Allow-list: YouTube, Vimeo, direct MP4 from allow-listed hosts (`ResolvableVideoSourceUrl`).
- **Replace:** swapping source is replace-only with an ownership-accurate confirmation; the previous
  uploaded asset remains in the Media Library (not deleted here); external sources are shared refs.
- **Reprocess:** `POST /videos/{id}/reprocess` (uploaded only; external → 422) resets the asset to
  `queued` and dispatches `TranscodeVideoAssetJob`.
- **Storage/delivery:** full hybrid inheritance (local canonical + R2 mirror, delivery resolver,
  immutable HLS artifacts) — identical to Reels §F.

---

## G) Lifecycle & Scheduling

- **Transitions** (`TransitionVideoStatusAction`): publish/schedule require `videos.publish`, archive
  `videos.archive`; publish/schedule are **blocked (422)** unless `hasPublishableMedia()`; schedule
  requires `published_at` (422 otherwise).
- **Auto-publish** (`PublishDueVideosAction` via `videos:publish-due`, registered in
  `SchedulerRegistry`, **everyMinute**, `critical`, manual-run allowed): distributed lock + row lock
  + in-transaction re-check (idempotent, race-safe with manual edits); system actor
  (`published_by_id = null`); a not-yet-ready scheduled video is **skipped and stays scheduled**
  (auto-retried next tick). Granular cache flush on publish.
- **URL history:** slug/locale change records the old canonical path (`video_url_history`) → public
  301 (same for playlists).

---

## H) Caching & Invalidation

`VideoCacheTags` (granular): `ALL=videos`, `feed(locale)`, `detail(locale,slug)`,
`category(locale,slug)`, `playlist(locale,slug)`, `SITEMAP=videos:sitemap`. A write flushes the
relevant feed + detail (+ category) + SITEMAP, **including the old equivalents** on slug/locale/
category change (no stale residue). Requires a tag-capable store (**Redis in production**, enforced
by `RedisProductionCheck`). The admin SPA invalidates the single React Query namespace
`['video-library']` on every mutation (no stale lists/stats/dashboard/analytics/operations).

---

## I) Engagement / Analytics / Operations

- **Engagement:** polymorphic `engagement_counters` (`views/likes/dislikes/favorites`); views recorded
  via the signed view-beacon on public detail (per-actor dedup); trending weight
  `views·1 + likes·4 + favorites·6 − dislikes·2`.
- **Analytics** (`GET /videos/analytics`): all-time engagement totals across **non-deleted** videos,
  top playlists by video count, weighted trending (public+playable only). The SPA Analytics page
  combines this with the dashboard (source/status distributions, top videos/categories) and labels
  the figures as all-time.
- **Per-video analytics + forward-only telemetry** (later phase): `GET /videos/{video}/analytics`
  (range `24h/7d/30d/custom`) adds real **over-time** charts (views/engagement) + **coarse traffic
  channels** via the polymorphic `content_daily_stats` daily rollup, plus distribution
  (featured/category/playlists/linked-VODs), URL-history and the publish timeline. **Video watch
  metrics** (starts/avg-watch/completion/drop-off) remain **deferred** — full current vs deferred
  split in `ai/analytics-telemetry-skill.md` (§A / §B).
- **Operations** (`GET /videos/operations`): `processing_health{processing,failed}`, `needs_attention`
  (uploaded videos with failed/processing media + `media_uuid`, ≤50), `publish_queue{scheduled_total,
  due_now, upcoming[] with overdue flag}` (≤20). The SPA exposes per-row **Reprocess** (confirmed,
  `videos.reprocess`-gated).

---

## J) Admin Frontend (SPA) Integration

- **Location:** `admin-frontend/src/features/video-library/{pages,components,hooks.ts}`; types in
  `types/videoLibrary.types.ts`; services `services/videos|videoCategories|videoPlaylists.service.ts`.
- **Nav/routes:** sidebar group "Video Library" directly below Reels → Dashboard / Videos / Categories
  / Playlists / Analytics / Operations (`router/paths.ts`, `config/navigation.ts`).
- **Data layer:** React Query hooks keyed under `['video-library', …]`; mutations toast + invalidate
  the namespace. Lists use `buildParams` → `filter[x]` exactly matching the allow-lists.
- **Shared UI:** `components/data/{DataTable,Pagination}`, `components/ui/*`, `components/form/*`,
  AI copilot + `SeoPanel` reused from `features/content`; VL-local `components/StatPrimitives.tsx`
  (`MetricCard`, `Panel`) shared across Dashboard/Analytics/Operations.
- **i18n:** `i18n/{ar,en}/videoLibrary.json` (registered as `videoLibrary` ns); nav keys in `common.json`.

---

## K) Operational Notes

- **Health checks** (at `/admin/system/health` + Ops Overview): `MediaProcessingHealthCheck`
  (stuck/failed transcodes), `RemoteStorageHealthCheck`, `SchedulerHealthCheck`, `RedisProductionCheck`.
- **Failed jobs:** `/admin/system/failed-jobs` lists/retries/clears failed transcode & mirror jobs.
- **Domain ops center:** `/video-library/operations` surfaces failed/processing uploads + one-click
  reprocess and the scheduled publish queue (due-now/overdue).
- **Commands:** `videos:publish-due` (cron, idempotent, locked); media sync/verify/repair commands are
  shared platform-wide (`media:sync:remote`, `media:verify:remote`, `media:repair:remote --pull`).
- **CDN:** video pages + API actively purged on writes via the shared CDN purge path (gated on
  `cdn_auto_purge`, queued, fail-safe); HLS artifacts immutable.

---

## L) Maintenance Notes

- **Adding a locale:** extend `Video::LOCALES` / `VideoCategory::LOCALES` / `VideoPlaylist::LOCALES`,
  the `{locale}` route constraint, and add the i18n JSON + filter options. Cache tags are locale-keyed
  already.
- **Adding a video source provider:** extend `ResolvableVideoSourceUrl` (+ the resolver) and the
  `source` i18n labels; `source_type` is a free string column (no enum migration needed for providers).
- **Adding a bulk action:** add to `BulkVideoRequest` enum + `BulkVideoAction::match` (+ `ABILITY` map
  if it needs a distinct permission) + the SPA bulk bar + a Pest case.
- **Permissions:** defined in `RolesAndPermissionsSeeder` (videos.*, video-categories.*,
  video-playlists.*). Re-run the seeder after edits; the SPA reads abilities from the user profile.
- **Slug edits** auto-record 301 history; never hard-rename slugs without relying on that path.
- **Tests:** `tests/Feature/Admin/VideoLibrary/*` + `tests/Feature/Public/VideoLibrary/*`. Keep the
  suite green; reorder/move and bulk invariants are covered there.

---

## M) Production Readiness Checklist (video domain)

- [x] RBAC enforced on every admin route; per-op abilities in bulk/transition; SPA gating mirrors backend.
- [x] Source required on create; ready-media guard on publish/schedule (manual + scheduler).
- [x] Scheduled auto-publish idempotent + locked + race-safe; system actor recorded.
- [x] Granular cache invalidation (incl. old slug/locale/category) on every write; Redis tag store enforced in prod.
- [x] Media pipeline: transcode retries/timeout/unique; failed-state visibility + reprocess; hybrid mirror + delivery resolver.
- [x] Public reads: published+playable only, single-flight cached, rate-limited, CDN-aware, Scout search bounded.
- [x] 301 redirects for slug/locale changes (videos + playlists).
- [x] Analytics/Operations use real aggregates only (no fabricated data).
- [x] Full backend suite green; SPA `typecheck` + production `build` green.
- [ ] **Operational prerequisites:** Redis (tag cache + queues) provisioned; `videos:publish-due` + media/engagement schedules running; queue workers for `redis-media`; R2 creds set if remote mirror enabled; Meilisearch reachable + `scout:import` for public video search.

---

## N) Deferred Scope (honest)

| Item | State | Notes |
|---|---|---|
| **`videos.sync` tooling** | **Reserved.** | Permission exists; no route/command yet. Wire to the shared remote-sync commands when per-domain sync UX is needed. |
| **Resumable / chunked upload** | **Deferred.** | Single streamed multipart upload (memory-safe), not tus/chunked. Fine for admin uploads. |
| **Engagement viral scaling** | **Deferred.** | Single counter row per video + beacon dedup; no durable backstop/reconciliation (platform-wide caveat). |
| **Materialized trending** | **Deferred (scale).** | Trending computed on read (weighted, limited). Materialize >100k videos. |
| **Sitemap chunking** | **Deferred (scale).** | Single sitemap per locale; chunk >50k URLs. |
| **Drag-and-drop reorder** | **Intentionally omitted.** | Up/down + parent-via-form matches the platform's category convention; no DnD library (no parallel architecture). |
| **Video watch telemetry** | **Deferred (dedicated phase).** | Starts / avg-watch / completion / drop-off / milestones — needs a new player-beacon ingestion pipeline. See `ai/analytics-telemetry-skill.md` §B.1 + §C. |
| **True historical unique viewers** | **Deferred.** | Current "unique reactors" is a current-snapshot distinct-actor count, not a historical unique-viewer series. See `ai/analytics-telemetry-skill.md` §B.2. |
