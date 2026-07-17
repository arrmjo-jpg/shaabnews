# Cache Invalidation — AlphaCMS

Canonical reference for how a content mutation in Laravel reaches Next.js's
ISR cache. Read this before adding any new `fetch()` with `next.tags`, before
adding a mutation Action that changes public output, and before debugging
"why didn't this update show up immediately."

This document describes the **event-driven invalidation path**
(`revalidateTag()`) — see `docs/architecture/NEXTJS-CACHING-GOTCHAS.md` for
the separate, related topic of *time-based* revalidate windows and why a
page's effective ISR interval is rarely the number written at its top.

Snapshot date: 2026-07-17, after the P0/P1 fixes below shipped
(`b8e734cc2b`, `baf2314c60`). Produced by a full audit of every mutation
Action and every tagged `fetch()` in the codebase — every claim in this
document traces to a specific file:line, not inference.

---

## 1. Architecture Overview

```
Admin Action (Create/Update/Delete/Publish/...)
        │
        ▼
FrontendRevalidate::tags(array $tags)          app/Support/Frontend/FrontendRevalidate.php
        │  no-op if services.frontend_revalidate.{url,secret} unset, or $tags === []
        ▼
RevalidateFrontendCacheJob::dispatch($tags)     app/Jobs/RevalidateFrontendCacheJob.php
        │  ->afterCommit() — waits for the DB transaction to commit before firing
        │  tries=1, timeout=15s — fire-and-forget, never retries, never blocks the write
        ▼
POST /api/revalidate                            (Laravel → Next.js, over HTTP)
        │  header: x-revalidate-secret
        │  body:   { tags: string[] }
        ▼
frontend/src/app/api/revalidate/route.ts
        │  validates secret (401 if wrong, 503 if unconfigured, 422 if no tags)
        ▼
revalidateTag(tag)  — once per tag
        │
        ▼
Next.js Data Cache entries carrying that tag are marked stale
        │
        ▼
Next request for an affected page triggers a fresh render (ISR "on-demand revalidate")
```

**Two independent systems exist under the name "cache" in this codebase — do not confuse them:**

| System | What it invalidates | Mechanism | Scope |
|---|---|---|---|
| **This document's subject** | Next.js Data Cache / ISR pages | `FrontendRevalidate::tags()` → `revalidateTag()` | Public site (`frontend/`) |
| Laravel response cache | RSS/Sitemap XML responses | `Cache::tags([...])->flush()` via `ArticleCacheTags`/`ReelCacheTags`/`VideoCacheTags` (`app/Support/Cache/*.php`) | Backend-only, served through Next.js as plain `no-store` proxies — see §7 |

A single mutation Action typically calls **both** (e.g. `Cache::tags([...])->flush()` for the Laravel-side response cache, then `FrontendRevalidate::tags()` for Next.js) — they are not redundant, they invalidate different things.

**Fire-and-forget by design**: if the frontend is down or misconfigured, `RevalidateFrontendCacheJob` logs a warning and gives up — it never retries (`tries=1`) and never throws back into the write path. The worst case is a page staying stale until its time-based `revalidate` safety net expires, never a broken publish.

---

## 2. Tag Registry (single source of truth)

Every tag string that exists anywhere in the system, where it's produced, where it's consumed. **If you add a tag, add a row here in the same PR** — this table existing and being wrong is worse than it not existing.

| Tag | Backend Producer | Frontend Consumer | Purpose |
|---|---|---|---|
| `homepage` | `FrontendCacheTags::article()` — always | *(none — see §8 Reserved)* | Intended to cover Hero/Latest/Breaking/Editors Pick as one umbrella; superseded by the specific `feed:*` tags below |
| `feed:hero` | `FrontendCacheTags::article()` — if `is_featured` set or changed | `lib/feed.ts: getHeroFeed()` | Homepage hero block |
| `feed:header` | `FrontendCacheTags::article()` — if `is_header` set or changed | `lib/feed.ts: getHeaderFeed()` | "آخر المستجدات" homepage block |
| `feed:breaking` | `FrontendCacheTags::article()` — if `is_breaking` set or changed *(added `b8e734cc2b`)* | `lib/feed.ts: getBreakingFeed()` | Breaking-news bar |
| `feed:latest` | `FrontendCacheTags::article()` — always | `lib/feed.ts: getLatestFeed()` | `/latest` + sidebar news widget |
| `feed:most_read` | `FrontendCacheTags::article()` — always | `lib/feed.ts: getMostReadFeed()` | "الأكثر قراءة" + `/trending` |
| `feed:editors_pick` | `FrontendCacheTags::article()` — if `is_editor_pick` set or changed | *(none — see §8 Reserved)* | No Editor's Pick section exists in the frontend yet |
| `search` | `FrontendCacheTags::article()` — always *(added `b8e734cc2b`)* | `lib/search.ts: searchArticles()` | Site search results |
| `articles` | `FrontendCacheTags::category()` — only on category slug change | `lib/feed.ts` (hero/header/breaking/latest/most_read/category-feed), `lib/articles.ts: getArticle()`, `lib/search.ts` | Broad umbrella; intentionally used sparingly backend-side (see the class doc-comment) — most of its frontend consumers are already covered by their own specific tag |
| `article:{slug}` | `FrontendCacheTags::article()` — current + old slug on rename | `lib/articles.ts: getArticle()` | Single article page |
| `category:{slug}` | `FrontendCacheTags::article()` (current + old categories on change), `FrontendCacheTags::category()` (current + old slug on rename) | `lib/feed.ts: getCategoryFeed()`, `getCategoryFeaturedGrid()`, `getCategoryPage()`, `getCategoryById()`/`getCategoryBySlug()`/`getCategoryAncestry()` (via the shared `categories` tag) | Category listing/landing pages |
| `categories` | `FrontendCacheTags::category()` — always | `lib/feed.ts` (nav/category-tree lookups), `lib/categories.ts: getCategories()` *(dead — no caller)* | Category tree/nav |
| `author_articles:{id}` | `FrontendCacheTags::article()` — current + old author on change | *(none — see §8 Reserved)* | No author-article-listing page exists in the frontend |
| `tag:{name}` | `FrontendCacheTags::article()` — current + old tags | *(none — see §8 Reserved)* | No tag-filtered listing page exists in the frontend |
| `live_updates` | `CreateLiveUpdateAction`/`UpdateLiveUpdateAction`/`DeleteLiveUpdateAction`/`MoveLiveUpdateAction` via `FrontendCacheTags::liveUpdates()` *(added `b8e734cc2b`)* | `lib/articles.ts: getLiveUpdates()` | Umbrella for all live-coverage updates |
| `live:{slug}` | same four Actions, same method | same | One specific live-coverage article |
| `page-feed:{locale}` | `PageCdnPurge` → `FrontendCacheTags::page()` | `lib/static-pages.ts: getStaticPages()` | Footer/header static-page lists |
| `page:{locale}:{slug}` | same (current + old slug on rename) | `lib/static-pages.ts: getStaticPage()` | Single static page |
| `reel-feed:{locale}` | `ReelCdnPurge` → `FrontendCacheTags::reel()` | `lib/reels.ts: getReelsFeed()` | Reels feed |
| `reel:{locale}:{slug}` | same (current + old slug on rename) | `lib/reels.ts: getReelByIdSlug()` | Single reel deep-link |
| `video-feed:{locale}` | Video actions → `FrontendCacheTags::fromVideoTags()` | `lib/videos.ts` (latest/featured/trending/most-viewed/related/by-category/playlists) | Video library listings |
| `video:{locale}:{slug}` | same | `lib/videos.ts: getVideo()` | Single video page |
| `video-category:{locale}:{slug}` | same, and `FrontendCacheTags::videoCategory()` | `lib/videos.ts: getVideosByCategory()` | Video-category listing |
| `playlist:{locale}:{slug}` | same | `lib/videos.ts: getPlaylist()` | Playlist page |
| `categories` (video-side reuse) | n/a — video categories use their own tag family above; no collision | — | — |
| `comments` | `DeleteCommentAction`/`ModerateCommentAction` → `FrontendCacheTags::comments()` | `lib/comments.ts: getComments()` | Umbrella for all comment lists |
| `comments:{slug}` | same | same | One article's comment list |
| `writers` | `UpdateUserAction`, `UpdateUserStatusAction`, `UploadAuthorAvatarAction` *(added `baf2314c60`)* | `lib/writer.ts: getWriterProfile()` | Writer directory-level data |
| `writer:{id}` | same three | same | Single writer profile page |
| `site-settings` | `UpdateGeneralSettingsAction`, `UpdateNewspaperSettingsAction`, `FrontendCacheTags::category()` (always) | `lib/site-settings.ts: getSiteSettings()` | Logo/theme/footer/nav/cookie-policy/newspaper toggle |
| `tts-config` | `UpdateThirdPartySettingsAction` | `lib/tts.ts: getTtsConfig()` | Text-to-speech feature flag |
| `social-config` | `UpdateThirdPartySettingsAction` | `lib/auth-config.ts: getSocialAuthConfig()` | Social login providers |
| `recaptcha-config` | `UpdateThirdPartySettingsAction` | `lib/recaptcha.ts: getRecaptchaConfig()` | reCAPTCHA toggle |
| `match-bar` | `UpdateMatchBarSettingsAction`, `UpdateCompetitionAction` | `lib/match-bar.ts: getMatchBar()` | Sport match-bar admin config (not live sport data — see §8) |
| `epaper-feed:{locale}` | *not verified this audit — flagged in §9* | `lib/epaper.ts` | Newspaper issue archive |
| `engagement`, `engagement:article:{id}` | *not applicable — high-frequency counters, time-based by design* | `lib/engagement.ts: getArticleMetrics()` | View/like/favorite counts |
| `weather`, `ase-ticker`, `ase-summary`, `ase-index`, `ase-movers`, `ase-docs`, `gold`, `sport-games`, `sport-game-{id}`, `sport-competition-{id}`, `sport-stats`, `broadcast-feed:{kind}`, `broadcast:{kind}:{slug}` | *none — external-API passthrough, see §7* | various `lib/*.ts` | Live external data; time-based revalidate is the correct and only mechanism |
| `ase` | *none* | `lib/ase.ts: getAseCompanies()` *(dead — no caller)* | — |

---

## 3. Mutation Matrix

Every content-mutating Action and exactly what it invalidates. "—" means confirmed no invalidation exists.

| Action | Tags Invalidated |
|---|---|
| `CreateArticleAction`, `UpdateArticleAction`, `DeleteArticleAction`, `ForceDeleteArticleAction`, `RestoreArticleAction` | `FrontendCacheTags::article()` via `ArticleCdnPurge::purge()` |
| `TransitionArticleStatusAction` (publish/unpublish/schedule) | same, via `ArticleStatusChanged` → `PurgeArticleCdnOnStatusChanged` listener |
| `PublishDueArticlesAction` (scheduled) | same, per article, inside the cron job |
| `ClearBreakingArticlesAction` (bulk-clear) | same, per article — automatically picks up `feed:breaking` now that `FrontendCacheTags::article()` checks `is_breaking` |
| *(no bulk-publish/bulk-delete article action exists)* | n/a |
| `CreateLiveUpdateAction`, `UpdateLiveUpdateAction`, `DeleteLiveUpdateAction`, `MoveLiveUpdateAction` | `FrontendCacheTags::liveUpdates()` — `live_updates`, `live:{slug}` |
| `CreateCategoryAction`, `UpdateCategoryAction`, `DeleteCategoryAction`, `RestoreCategoryAction`, `ForceDeleteCategoryAction`, `MoveCategoryAction` | `FrontendCacheTags::category()` |
| `BulkUpdateCategoriesAction` | `FrontendCacheTags::category()` per affected category, deduplicated union |
| `CreateVideoAction`, `UpdateVideoAction`, `DeleteVideoAction`, `RestoreVideoAction`, `ForceDeleteVideoAction`, `BulkVideoAction`, playlist actions (`Create/Update/Delete/Restore/ForceDelete/Attach/Detach/Reorder`) | `FrontendCacheTags::fromVideoTags()` |
| `TransitionVideoStatusAction` | same, via `VideoStatusChanged` → `RevalidateVideoFrontendOnStatusChanged` listener |
| `PublishDueVideosAction` (scheduled) | same, inside the cron job |
| `UpdateVideoCategoryAction`, `MoveVideoCategoryAction` | `FrontendCacheTags::videoCategory()` / `fromVideoTags()` |
| `CreateReelAction`, `UpdateReelAction`, `DeleteReelAction`, `RestoreReelAction`, `ForceDeleteReelAction` | `FrontendCacheTags::reel()` via `ReelCdnPurge::purge()` |
| `TransitionReelStatusAction` | same, via `ReelStatusChanged` → `PurgeReelCdnOnStatusChanged` listener |
| `PublishDueReelsAction` (scheduled) | same, inside the cron job |
| `DeleteCommentAction`, `ModerateCommentAction` | `FrontendCacheTags::comments()` |
| `UpdateUserAction`, `UpdateUserStatusAction`, `UploadAuthorAvatarAction` | literal `['writers', "writer:{id}"]` |
| `DeleteUserAction`, `RestoreUserAction` | **—** (author soft-delete/restore does not invalidate `writers`/`writer:{id}`) |
| `UpdateTagAction`, `DeleteTagAction` | **—** (harmless today — no frontend consumer of `tag:{name}` exists, see §8) |
| `UpdateGeneralSettingsAction`, `UpdateNewspaperSettingsAction` | `['site-settings']` |
| `UpdateThirdPartySettingsAction` | `['tts-config', 'social-config', 'recaptcha-config']` |
| `UpdateMatchBarSettingsAction`, `UpdateCompetitionAction` | `['match-bar']` |
| All `app/Actions/Admin/Advertising/*` (15 actions) | **—** by design (ads are always client-side `no-store`, never cached) |
| All `app/Actions/Admin/Polls/*` (6 actions) | **—** (no frontend feature consumes poll data — see §8) |
| Gallery-related | n/a — no Gallery model/feature exists |

---

## 4. Frontend Fetch Matrix

Every `fetch()` in `frontend/src` that carries `next.tags`. Full detail (dead code, per-file line numbers) lives in the audit transcript; this is the canonical quick-reference. Fetches using `cache: 'no-store'` (ads, per-user account/follow/engagement BFFs, RSS/sitemap proxies, auth mutations) carry no tags and are omitted — they are never meant to be tag-invalidated.

| Fetch (`lib/*.ts`) | Tags | Revalidate (s) |
|---|---|---|
| `feed.ts: getHeroFeed` | `articles`, `feed:hero` | 300 |
| `feed.ts: getHeaderFeed` | `articles`, `feed:header` | 300 |
| `feed.ts: getBreakingFeed` | `articles`, `feed:breaking` | 60 |
| `feed.ts: getLatestFeed` | `articles`, `feed:latest` | 60 |
| `feed.ts: getMostReadFeed` | `articles`, `feed:most_read` | 300 |
| `feed.ts: getCategoryById/BySlug/Ancestry` | `categories` | 300 |
| `feed.ts: getCategoryFeed/FeaturedGrid/Page` | `articles`, `category:{slug}` | 300 |
| `articles.ts: getArticle` | `articles`, `article:{slug}` | 1800 |
| `articles.ts: getLiveUpdates` | `live_updates`, `live:{slug}` | 1800 |
| `videos.ts` (latest/featured/trending/most-viewed/related/by-category/playlists index) | `video-feed:{locale}` (+ `video-category:*` where relevant) | 120 |
| `videos.ts: getVideo` | `video:{locale}:{slug}` | 120 |
| `videos.ts: getPlaylist` | `playlist:{locale}:{slug}` | 120 |
| `reels.ts: getReelsFeed` | `reel-feed:{locale}` | 60 |
| `reels.ts: getReelByIdSlug` | `reel:{locale}:{slug}` | 60 |
| `match-bar.ts: getMatchBar` | `match-bar` | 60 |
| `writer.ts: getWriterProfile` | `writers`, `writer:{id}` | 300 |
| `static-pages.ts: getStaticPages` | `page-feed:{locale}` | 300 |
| `static-pages.ts: getStaticPage` | `page:{locale}:{slug}` | 300 |
| `search.ts: searchArticles` | `articles`, `search` | 60 |
| `site-settings.ts: getSiteSettings` | `site-settings` | 300 |
| `recaptcha.ts: getRecaptchaConfig` | `recaptcha-config` | 300 |
| `auth-config.ts: getSocialAuthConfig` | `social-config` | 300 |
| `tts.ts: getTtsConfig` | `tts-config` | 300 |
| `comments.ts: getComments` | `comments`, `comments:{slug}` | 1800 |
| `epaper.ts` | `epaper-feed:{locale}` | 300 |
| `engagement.ts: getArticleMetrics` | `engagement`, `engagement:article:{id}` | 300 |
| `weather.ts` | `weather` | 900 / 1800 |
| `ase-market.ts`, `gold.ts` | `ase-ticker`/`ase-summary`/`ase-index`/`ase-movers`/`ase-docs`/`gold` | 120–300 |
| `sport/games.ts`, `sport/player.ts`, `sport/stats.ts` | `sport-games`/`sport-game-{id}`/`sport-competition-{id}`/`sport-stats` | 30–86400 (tiered by data volatility) |
| `broadcast.ts` | `broadcast-feed:{kind}`, `broadcast:{kind}:{slug}` | 30 |

**Dead code found during the audit (tagged fetch, zero callers)** — harmless, but flag before relying on them: `lib/categories.ts: getCategories()`, `lib/ase.ts: getAseCompanies()`, `lib/sport/games.ts: getTeamGames()`, `lib/sport/stats.ts: getCompetitionTeams()`.

---

## 5. Event Flow — worked examples

### Publish an article (manual or scheduled)
```
TransitionArticleStatusAction / PublishDueArticlesAction
        │
        ▼
ArticleStatusChanged event  (manual path only)
        │
        ▼
ArticleCdnPurge::purge($article)
        │
        ├── FrontendCacheTags::article($article, ...)
        │       → homepage, feed:latest, feed:most_read, article:{slug},
        │         feed:hero/header/breaking (conditional), category:{slug}×N,
        │         author_articles:{id}, tag:{name}×N, search
        │
        ├── FrontendRevalidate::tags(...) → Queue → POST /api/revalidate → revalidateTag() × N
        │
        ├── CDN edge purge (Cloudflare, if cdn_auto_purge enabled)
        │
        └── SearchEngineNotify::sitemaps() (if newly published)

Next visitor to any affected page (homepage, category, the article itself,
search) triggers a fresh Server Component render — no wait for the
time-based revalidate window.
```

### Post a live-coverage update
```
CreateLiveUpdateAction / UpdateLiveUpdateAction / DeleteLiveUpdateAction / MoveLiveUpdateAction
        │
        ├── Cache::tags(['live_updates'])->flush()   (Laravel-side, unrelated system)
        │
        └── FrontendRevalidate::tags(FrontendCacheTags::liveUpdates($article))
                → live_updates, live:{slug}
                → Queue → POST /api/revalidate → revalidateTag() × 2

Next visitor to that article's page re-fetches getLiveUpdates() fresh.
(Fixed in b8e734cc2b — previously this step did not exist; updates could
take up to 1800s, the fetch's own revalidate, to appear.)
```

### Delete a category (soft or force)
```
DeleteCategoryAction / ForceDeleteCategoryAction
        │
        ▼
FrontendRevalidate::tags(FrontendCacheTags::category($category))
        → categories, site-settings, category:{slug}
        → Queue → POST /api/revalidate → revalidateTag() × 3

Nav, homepage category blocks, and the category's own landing page all
revalidate on next visit. (ForceDelete captures the tags before the row is
gone, since relations would otherwise be lost.)
```

### Bulk category status/visibility change
```
BulkUpdateCategoriesAction
        │
        ├── Cache::tags(['categories'])->flush()   (Laravel-side)
        │
        └── FrontendRevalidate::tags(
                merge of FrontendCacheTags::category($c) for every $c in the batch
            )
                → single dispatch, deduplicated tag union across all affected categories

(Fixed in baf2314c60 — previously only the first line existed; a bulk edit
across N categories relied solely on the 300s safety net.)
```

---

## 6. Design Rules

1. **Every new `fetch()` in the render tree must declare `next: { tags, revalidate }` explicitly.** No cache option at all silently defaults to `force-cache` forever (never revalidates without a tag hit) — see `docs/architecture/NEXTJS-CACHING-GOTCHAS.md` for what happens when this is gotten wrong.
2. **Every mutation that changes what a tagged fetch returns must call `FrontendRevalidate::tags(...)` with that fetch's exact tag(s)**, immediately after (or via `->afterCommit()` semantics, already built into the job). Do not rely on the time-based `revalidate` window as a substitute for real invalidation — that window is a safety net for infrastructure failures, not the primary freshness mechanism.
3. **Any new tag must be added to the Tag Registry (§2) in the same PR** that introduces it — on both the producing side (which Action/method emits it) and the consuming side (which `fetch()` uses it). A tag with only one side filled in is either dead code or a bug; this table is how a future reviewer tells the difference without re-auditing the whole codebase.
4. **Prefer specific tags over the `articles`/`categories` umbrella tags** for anything with its own tag family already (e.g. `feed:latest` over reusing `articles`) — the umbrella exists for the one legitimate cross-cutting case (category slug rename affecting cached article breadcrumbs), not as a default.
5. **Any new content-mutating feature needs a test asserting the invalidation call happens** — `Queue::fake()` + `Queue::assertPushed(RevalidateFrontendCacheJob::class, fn ($job) => in_array('your:tag', $job->tags))` is the pattern used to verify the P0/P1 fixes in this document; follow it, don't just eyeball the code.
6. **External-API passthrough data (sport, weather, market/gold, ads) never needs `FrontendRevalidate`** — there is no Laravel-authored content to invalidate; its own tiered time-based `revalidate` (30s–86400s by volatility) is the correct and only freshness mechanism. Don't "fix" these by adding invalidation calls that have nothing to invalidate.

---

## 7. Two unrelated caching layers, not covered by this document

- **Laravel `Cache::tags()->flush()`** (`ArticleCacheTags`/`ReelCacheTags`/`VideoCacheTags`) backs RSS/Sitemap XML responses and other backend-only response caches. `frontend/src/app/{rss.xml,sitemap.xml,rss/[feed].xml,[sitemap].xml}/route.ts` proxy these with `cache: 'no-store'` and set their own `Cache-Control` header — no `revalidateTag` involvement, and none is needed.
- **Image/media Cache-Control** (browser + CDN, `max-age=30d` set in `docker/php/nginx-backend.conf`/`docker/nginx/default.conf`) is entirely separate from Next.js's Data Cache. Re-processing a media asset's derivatives after it's already attached to a published article (e.g. a watermark backfill) is **not** an ISR problem — if the URL is unchanged, browsers/CDNs may keep serving the old bytes until the 30-day image cache expires, regardless of anything in this document. This was flagged during the Cache Invalidation Audit as a separate, unverified concern — not a regression, not in scope here.
- **Laravel Scout / Meilisearch** (`ResilientSearchable` on `Article`/`Broadcast`/`Reel`/`Video`) reindexes automatically via Eloquent's Scout observer on save/delete, fully independent of `FrontendRevalidate`. This is expected — search indexing and Next.js page caching are different systems solving different problems.

---

## 8. Reserved / Currently Unused Tags

These tags are produced by the backend but have no frontend consumer today. **Do not delete the backend code that emits them** without first confirming the corresponding frontend feature is genuinely never planned — they may be scaffolding for features not yet built:

| Tag | Why it might exist |
|---|---|
| `homepage` | Its own doc-comment states intent to cover Hero/Latest/Breaking/Editors Pick as a single umbrella; superseded in practice by the four specific `feed:*` tags, but costs nothing to keep emitting |
| `feed:editors_pick` | Implies an "Editor's Pick" homepage section is planned but not yet built |
| `author_articles:{id}` | Implies an author-article-listing page (e.g. `/writer/{id}/articles`) is planned but not yet built |
| `tag:{name}` | Implies a tag-filtered article listing page is planned but not yet built |

If a future feature adds the missing frontend consumer for any of these, the backend invalidation already exists and needs no changes — just wire up the `fetch()` with the matching tag and update §2/§4 above.

---

## 9. Open items not resolved by this document

- **`broadcast-feed:{kind}`/`broadcast:{kind}:{slug}`** — Broadcast (live/tv/radio) admin mutations were not audited for `FrontendRevalidate` calls in the P0/P1 passes. Needs a follow-up check before relying on immediate invalidation for that content type.
- **`epaper-feed:{locale}`** — only newspaper *settings* mutations (`UpdateNewspaperSettingsAction` → `site-settings`) were confirmed; epaper *issue* upload/publish was not traced to a `FrontendRevalidate` call in this audit.
- **Polls** — six admin Actions exist with zero invalidation and (per this audit) zero frontend consumer. Per the 2026-07-17 review: do not add invalidation before confirming the feature is actually surfaced anywhere in the frontend — adding cache-invalidation plumbing for a feature nobody can see would be complexity with no payoff.
