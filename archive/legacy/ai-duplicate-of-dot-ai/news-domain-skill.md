# AlphaCMS — News Domain Engineering Skill

> Single source of truth for the **News** domain. Frontend, mobile, and backend
> engineers (and AI agents) should be able to integrate without reverse-engineering
> code. Everything here reflects the **actual implementation** (verified by tests).
> Reels, WordPress migration, and unrelated platform concerns are **out of scope**.

All public endpoints are prefixed `/api/v1/{locale}` where `locale ∈ {ar, en}`
(route-constrained; an unknown locale 404s at the route, an unsupported one returns
422 from the action). Responses use the standard envelope: `{ "data": ..., "meta": ... }`
for success, `{ "success": false, "message": ..., "errors": ... }` for errors.

---

## A) Domain Overview

The news system manages **Articles** (types: `news`, `opinion`, `live`, plus any
configured) organized under **Categories** and **Tags**, with **hybrid media**
(local-canonical + optional R2 mirror). It powers:

- **Public surfaces** (read-only, cached, CDN-aware, SEO-rich): homepage, category
  pages, article detail, search, breaking ticker, most-read/trending, feeds, sitemaps,
  301 redirects.
- **Admin/editor surfaces** (RBAC-guarded): article CRUD, publish lifecycle workflow,
  true preview, SEO guidance, slug-conflict checking, breaking/featured controls,
  scheduled publishing, media attachment.

Supported workflows: draft → scheduled → published (+ archived / soft-deleted /
restored / force-deleted), automatic scheduled publishing, breaking-news promotion,
SEO metadata authoring, translation linking via `translation_group` (hreflang).

---

## B) Public News Architecture

| Endpoint | Purpose | Pagination | Cache tag | CDN TTL (s-maxage) |
|---|---|---|---|---|
| `GET /{locale}/articles` | Article list (filters + sort) | offset (default) / `?paginate=cursor` | `feed(locale)` or `category(locale,slug)` | 300 (default) |
| `GET /{locale}/articles/breaking` | Breaking ticker (slim) | none (limit 10) | `feed(locale)` | 45 |
| `GET /{locale}/articles/most-read` | Most-read (tracked views) | none (`?per_page`, `?days`) | `feed(locale)` | 45 |
| `GET /{locale}/articles/trending` | Trending (weighted, 7-day window) | none (`?per_page`) | `feed(locale)` | 45 |
| `GET /{locale}/articles/{slug}` | Article detail (full) | — | `detail(locale,slug)` | 1800 recent / 86400 archive |
| `GET /{locale}/articles/{slug}/live-updates` | Live ticker (ETag/304) | offset | `live_updates` | short (ETag-driven) |
| `GET /{locale}/redirects/articles?path=` | 301 resolver for old canonical paths | — | — | — |
| `GET /{locale}/categories` | Category tree | — | `categories` | 300 |
| `GET /{locale}/categories/{slug}` | Category detail (metadata) | — | `categories` | 300 |
| `GET /{locale}/feed/{kind}` | `hero\|breaking\|header\|editors_pick\|story\|latest` | none | `feed(locale)` + `placements` | 300 |
| `GET /{locale}/homepage` | Full homepage aggregate (all zones + latest) | none | `feed(locale)` + `placements` | 300 |

**List filters** (`/articles`): `filter[type]`, `filter[category]={categorySlug}`,
`filter[tag]={tagName}`, `filter[q]={search}` (full-text via Meilisearch — see §B.search),
`sort` ∈ `published_at | -published_at | views_count | -views_count` (default `-published_at`),
`per_page` (capped by `performance.pagination.max`).

**Detail behaviour:** returns full article (`content_html` sanitized, media cover/gallery/video,
tags, secondary categories, `seo` block, flags, `event_status`). Only **published** articles
(status=published AND `published_at <= now`). A request for an **old slug** (after a slug/locale
change) returns **HTTP 301** with `Location` to the current article URL (see §B.redirects). A
truly unknown slug → 404.

**Search (`filter[q]`):** routed through **Laravel Scout → Meilisearch** (index
`articles_index`). Indexed fields: title, subtitle, excerpt, **body (stripped HTML)**,
category name, tags. Only published articles are indexed (`shouldBeSearchable`). Results are
relevance-filtered by the engine then constrained by all other list filters + locale +
pagination (the engine returns matching IDs → `whereIn`). **Typo tolerance** is provided by
Meilisearch. Falls back to the Scout `collection`/`database` driver if Meili is down.

**Redirects:** `ArticleUrlHistory` captures the old canonical path on every slug/locale change.
- The detail endpoint 301s an old **slug** to the current article URL (handles slug *and*
  locale changes; chains resolve to the *current* slug; loop-guarded).
- `GET /{locale}/redirects/articles?path=/{locale}/articles/{id}-{oldslug}` resolves a full old
  **canonical path** to a 301 (for SSR catch-all / crawlers). Lookup is indexed on
  `(locale, old_path)`.

**Cache behaviour:** all hot reads use **single-flight** caching (`CachedRead`) — one request
rebuilds a key; concurrent requests block briefly then read the warm value; on lock timeout they
compute directly (no stampede, no deadlock). A cached `null` is distinguished from a miss (no
recompute storm on 404/redirect paths). Requires a tag-capable store (**Redis in production** —
enforced by `RedisProductionCheck`).

**SEO architecture:** see §G of the editorial workflow and the dedicated SEO section below
(canonical, hreflang+x-default, OG, Twitter, JSON-LD NewsArticle/Article + BreadcrumbList,
sitemaps). The backend is the **source of truth** for SEO; the SSR site renders the `<head>`
from the `seo` block in the detail response.

---

## C) Mobile App Integration Guide (mandatory)

**Recommended endpoint map**

| Screen | Endpoint |
|---|---|
| Home feed (infinite scroll) | `GET /{locale}/articles?paginate=cursor&per_page=20` |
| Breaking ticker (poll ~30–60s) | `GET /{locale}/articles/breaking` |
| Category feed (infinite scroll) | `GET /{locale}/articles?filter[category]={slug}&paginate=cursor` |
| Article detail | `GET /{locale}/articles/{slug}` |
| Search | `GET /{locale}/articles?filter[q]={query}&paginate=cursor` |
| Most-read widget | `GET /{locale}/articles/most-read?per_page=10` |
| Trending widget | `GET /{locale}/articles/trending?per_page=10` |
| Homepage layout | `GET /{locale}/homepage` |

**Cursor vs offset:** **Use cursor (`?paginate=cursor`) for all mobile scrolling.** It returns
`meta.cursor = { next_cursor, prev_cursor, has_more, per_page }` — pass `?cursor={next_cursor}`
for the next page. Cursor pagination is O(1), has no `COUNT`, and does not drift when new
articles are published mid-scroll. Offset (`?page=N`, returns `meta.pagination.total/last_page`)
is the default and is fine for admin/SEO but **not** for deep mobile scroll.

**Breaking consumption:** poll `/articles/breaking` every 30–60s. Payload is intentionally tiny
(`id, title, slug, canonical_path, published_at, cover_thumb`) and has a short edge TTL (45s) —
safe to poll.

**Article detail loading:** request by `slug`. Always **follow 301** responses (old slug →
current). The detail payload includes `content_html` (pre-sanitized; render as HTML),
`media.cover/gallery/video`, `seo`, `flags`, `event_status`/`is_live`.

**Image/media usage:** list/feed payloads carry only a `cover` object
(`url`, `thumb`, `medium`, `alt`) — use `thumb` for list rows, `medium`/`url` for headers.
Detail payloads carry full `media`. **All media URLs are absolute.** Video assets expose
progressive `url` (+ HLS where transcoded) — prefer HLS for streaming.

**Caching expectations:** responses are CDN-cacheable; respect `Cache-Control`
(`s-maxage` + `stale-while-revalidate`). Breaking/most-read/trending are short-lived; detail is
long-lived (immutable-ish, busted on edit via active CDN purge). Client-side, a short memory
cache keyed by URL is safe.

**Localization:** pass the locale in the path (`/ar/...` or `/en/...`). The backend currently
returns localized API **messages** for both locales (lang parity complete). hreflang/translation
siblings are exposed in the detail `seo.hreflang` (incl. `x-default`).

**Trending / most-read:** both are real (engagement-backed) — see §G analytics caveats (these
rank by **tracked** views/engagement, which differs from the editorially-editable `views_count`
field shown on the article).

---

## D) React Web Frontend Guide (mandatory)

**Homepage composition:** call `GET /{locale}/homepage` for a single-round-trip aggregate of
every placement zone (`hero`, `breaking`, `header`, `editors_pick`, `story`) plus `latest`. Each
zone is an array of slim article items. For finer control, call individual `GET /{locale}/feed/{kind}`.

**Category pages:** `GET /{locale}/categories/{slug}` for category metadata + a filtered list via
`GET /{locale}/articles?filter[category]={slug}` (offset for SEO-paginated pages, cursor for
client-side "load more").

**Article detail rendering:** `GET /{locale}/articles/{slug}`. Render `content_html` directly
(sanitized server-side). Use the `seo` block to populate `<head>`:
- `seo.title`, `seo.description`, `seo.canonical_url`, `seo.robots`
- `seo.og.*` (OpenGraph), `seo.twitter.*` (Twitter cards)
- `seo.hreflang[]` (+ `x-default`)
- `seo.structured_data` → emit as `<script type="application/ld+json">` (NewsArticle/Article)
- `seo.breadcrumbs` → emit as a **second** `ld+json` script (BreadcrumbList)

**Search UX:** `GET /{locale}/articles?filter[q]=...` (Meilisearch relevance + typo tolerance).
Debounce input; combine with `filter[category]`/`filter[type]` as needed.

**SEO / SSR:** SSR is strongly recommended for article/category/home pages. The backend provides
all `<head>` data; the SSR must render canonical (`/{locale}/articles/{id}-{slug}` — the stable
id-prefixed form), JSON-LD, OG/Twitter, and hreflang. **Honor 301s** from the API for old slugs.

**Cache expectations:** identical to mobile — respect `Cache-Control`. The edge is actively
purged on publish/update/delete/slug-change (Cloudflare), so SSR caches can be aggressive.

**Breaking integration:** poll `/{locale}/articles/breaking` or surface the homepage `breaking`
zone; render a ticker. Short TTL keeps it fresh.

---

## E) Editorial Workflow

**Article lifecycle (status):** `draft → scheduled → published`, plus `archived`, soft-delete
(trash) → restore → force-delete. Transitions go through `TransitionArticleStatusAction` guarded
by `ArticleWorkflowGuard` (role-gated: publish/schedule/reject/archive are editorial-only).

- **Draft:** editing state; never public. Editors preview via the true-preview endpoint.
- **Scheduled:** `status=scheduled` + future `published_at`. The `articles:publish-due` scheduled
  command (cron `* * * * *`, idempotent, distributed-lock + row-lock) flips due scheduled
  articles to `published`, flushes caches, and triggers CDN purge automatically.
- **Published:** `status=published` AND `published_at <= now` — the only state the public
  endpoints serve.

**True preview:** `GET /api/v1/admin/articles/{id}/preview` (perm `articles.view`) returns the
**exact public payload** (`PublicArticleResource` incl. `seo`) for **any** status, so editors see
drafts/scheduled exactly as end users will — plus `seo_guidance` (see below). No fake preview.

**SEO editorial guidance:** included in the preview response (`seo_guidance[]`). Real checks only
(`ArticleSeoGuidance`): title length (too long >60 / too short <15), description missing/long/short,
missing cover/share image, SEO-title derived (not custom), canonical overridden, robots `noindex`.
Each item = `{ key, severity: ok|info|warn, detail }` — the frontend maps keys to messages.

**Slug conflict UX:** `GET /api/v1/admin/articles/slug-check?slug=&locale=&ignore_id=` returns
`{ available, slug (normalized), suggestion }`. On conflict it suggests `{slug}-2`, `{slug}-3`, …
Use this for inline, friendly slug feedback instead of raw validation errors.

**Breaking / featured controls:** boolean flags on the article — `is_breaking`, `is_featured`,
`is_header`, `is_editor_pick` (admin resource exposes them; public exposes them under `flags`).
`POST /api/v1/admin/articles/clear-breaking` clears `is_breaking` across all articles in one
audited action. Homepage promotion is driven by **placements** (editorial zones), independent of
the boolean flags (the homepage/feeds use placements; the breaking *fast-lane* ticker uses the
`is_breaking` flag).

**Publish diagnostics:** if scheduled publishing or a media/transcode job fails, diagnostics are
surfaced operationally via the admin **Failed Jobs** tooling, the **Ops Overview** dashboard, and
the **Scheduler** health (last status/last error per task). Article-level transcode failures are
recorded in the media asset's `metadata.processing_error`.

---

## F) News Data Model

- **`articles`** — `id`, `locale`, `type`, `status`, `slug` (unique per locale), `title`,
  `subtitle`, `excerpt`, `content_json` (TipTap source of truth), `content` (sanitized HTML,
  derived), `seo_title/seo_description/seo_keywords/canonical_url/robots`, `og_image_id`,
  `is_breaking/is_featured/is_header/is_editor_pick`, `comments_enabled`, `event_status` (live),
  `views_count` (editorial, see analytics caveat), `published_at`, `published_by_id`,
  `translation_group` (hreflang linking), `primary_category_id`, soft-delete `deleted_at`.
  Canonical path: `/{locale}/articles/{id}-{slug}` (id-prefixed = stable). Uses `Sluggable`,
  `HasTags`, `HasEngagement`, `Searchable` (Scout), `AuditsChanges`, `SoftDeletes`.
- **`categories`** — `locale`, `slug`, `name`, `status`, tree (`parent_id`, `sort_order`),
  soft-deletes. Articles have one primary + up to 3 secondary categories.
- **tags** — Spatie Tags (polymorphic), per article.
- **`article_media`** (pivot articles↔`media_assets`) — `collection` ∈ `cover|gallery|inline|video`,
  `position`. List/feed load **cover only**; detail loads all.
- **`article_url_history`** — `article_id`, `locale`, `old_path`, `reason`; unique `(locale, old_path)`.
  Powers 301 redirects.
- **`engagement_counters`** (polymorphic) — `engageable_type/id`, `views`, `likes`, `dislikes`,
  `favorites`. The **real** tracked-views source; powers most-read/trending.
- **`article_revisions`** — snapshot history per save (provenance).
- **`media_assets`** — hybrid local+R2 assets (see media domain; out of scope here).

---

## G) Operational Notes

- **Cache invalidation:** granular tags via `ArticleCacheTags` — a write flushes only
  `feed(locale)` + `detail(locale,slug)` + `category(locale,catSlug)` + `sitemap` (+ old
  equivalents on slug/locale/category change). The `ALL='articles'` umbrella tag sits on every
  entry for manual full flush. Editing one article does **not** flush other articles, other
  locales, or unrelated categories.
- **CDN purge:** `ArticleCdnPurge` actively purges Cloudflare edge on create/publish/update/
  delete/slug-change/restore/clear-breaking/scheduled-publish. Gated on `cdn_enabled` +
  `cdn_auto_purge`; queued (`ProcessCdnPurgeBatch`), fail-safe, never blocks the write.
- **Search indexing:** prod uses Meilisearch. One-time bootstrap:
  `php artisan scout:sync-index-settings` then `php artisan scout:import "App\Models\Article"`.
  Articles auto-sync to the index on save (set `SCOUT_QUEUE=true` to offload). Set
  `SCOUT_DRIVER=collection` (or `database`) for local/CI without Meili. Only published articles
  are indexed.
- **Scheduler dependencies:** `articles:publish-due` runs every minute (idempotent, locked). If
  the scheduler/worker is down, scheduled articles won't publish — monitored by the scheduler
  heartbeat health check. **Redis is required in production** for queue + cache tags
  (`RedisProductionCheck` fails the health check otherwise).
- **Analytics caveats:** there are **two** view numbers. `articles.views_count` is an
  **editorially-editable** display field and is **not** auto-incremented by traffic.
  `engagement_counters.views` is the **real tracked** count (incremented by `EngagementService`
  with a 30-minute per-actor dedup, atomic increment, abuse-resistant). **most-read** and
  **trending** rank by `engagement_counters` (real engagement), not by the editorial field.
- **Failure recovery:** failed mirror/transcode/publish jobs are visible + retryable via the
  admin Failed Jobs tooling and Ops Overview; CDN purge failures are logged and non-blocking.
- **SEO publisher config:** set `SEO_PUBLISHER_LOGO` (absolute URL, ≥112px tall) and
  `SEO_PUBLISHER_NAME` in production for valid Google News rich results.

---

## H) Future Extensions (deferred — honest status)

| Feature | Current state | Notes |
|---|---|---|
| **Comments** | **Deferred.** No `Comment` model, storage, API, or moderation. | `articles.comments_enabled` is a forward-looking contract flag exposed publicly so a future comment system can gate per-article. Nothing reads it server-side yet. |
| **Push notifications / breaking alerts** | **Deferred (config scaffolding only).** | Firebase service-account upload exists in settings (`ThirdPartySettings`), but there is **no** push sender wired to breaking news. Implementing requires an FCM channel + a "notify on breaking" trigger. |
| **Newsletter / news subscriptions** | **Not implemented.** | No subscriber model, signup, or digest. Greenfield. |
| **Advanced editorial workflow** | Basic lifecycle + roles implemented. | Multi-step approval chains, editorial calendars, and per-field locking are not implemented. |
| **Translation linking UI** | Backend `translation_group` + hreflang fully supported. | Admin UX for *linking* an article to its translation siblings may be limited; the data model supports it. |
| **Relevance-ordered search results** | Engine pre-filters by relevance; final ordering is recency of relevant results. | Strict relevance-score ordering across the cached/filtered list path was a deliberate trade-off (recency-of-relevant is a sound news default). |
| **Comment-driven engagement** | Engagement = views/likes/favorites/dislikes only. | No comment counts in trending/most-read scoring. |
