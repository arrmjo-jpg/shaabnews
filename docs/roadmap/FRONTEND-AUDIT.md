# Next.js Public Frontend Audit

**Read-only audit. No fixes applied in this pass** — findings only, per explicit
instruction. Scope: the Next.js 15 / React 19 public frontend at
`frontend/src`, cross-checked against the Laravel API it consumes. Every
finding below cites file + line and, where the claim concerns backend
behavior, the exact Laravel source that confirms it — nothing here is
asserted from memory of typical Next.js/Laravel patterns.

**Method**: direct reading of the full content data layer (`lib/articles.ts`,
`feed.ts`, `categories.ts`, `search.ts`, `writer.ts`, `videos.ts`, `reels.ts`,
`epaper.ts`), the site shell (`(site)/layout.tsx`, `QalahHeader`,
`QalahFooter`, `nav-data.ts`), and the homepage (`(site)/page.tsx`), plus
three research passes covering: (1) the Laravel public API surface — every
route, controller, Action, and Resource behind the 9 core endpoints, verified
against `git log -p` where a discrepancy was suspected; (2) the remaining ~30
`lib/*.ts` modules and all 30 `app/api/*` BFF route handlers; (3) a complete
inventory of every `page.tsx`/`layout.tsx` in `src/app` — fetch calls,
`generateMetadata`, JSON-LD, and loading/error/not-found boundaries.

**Not covered in this pass** (static/code-only audit — would need a live
browser to verify): actual rendered accessibility (ARIA, focus order,
contrast), actual responsive breakpoint behavior, actual RTL layout
correctness beyond `dir` attributes, and Lighthouse-style runtime performance
metrics. Where relevant, findings below are scoped to what's verifiable from
source alone, and that boundary is stated explicitly rather than guessed
past.

---

## Executive summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 9 |
| Low | 9 |
| Verified – No Issues Found | 7 areas |

No critical issues: nothing found crashes the site, exposes secrets, or
causes data loss. The two High findings are both real, currently-live,
user-facing correctness bugs on the English site. Most Medium/Low findings
are SEO-completeness gaps, i18n hardcoding, or double-fetch inefficiencies —
none are security issues.

---

## High severity

### H1. English category pages show Arabic content in the sidebar

**Location**: `frontend/src/components/reading/sidebar-news-widget.tsx:9`

**Evidence**: the component calls `getLatestFeed('ar')` and
`getMostReadFeed('ar', 10)` with the locale **hardcoded to `'ar'`**, no
parameter to override it. It's rendered (via `ReadingSidebar`) on
`article/[id]`, `pages/[slug]`, `writer/[id]`, `(site)/not-found.tsx`, and
— critically — **both** `(site)/category/[id]/[name]/page.tsx` and
`en/category/[id]/[name]/page.tsx`.

**Cause**: the widget was written once for the Arabic site and never
parameterized when the `/en` route group was added.

**Impact**: an English-locale reader on `/en/category-{id}/{name}` sees a
"Latest"/"Most Read" sidebar populated entirely with Arabic-language
headlines linking to Arabic article pages. Confirmed live and reachable —
`en/category/[id]/[name]` is a real, currently-shipped route.

**Proposed solution**: thread the page's `locale` through
`ReadingSidebar`/`SidebarNewsWidget` into both calls, matching the pattern
every other content-fetching function in `lib/` already follows (`locale`
param, default `'ar'`).

### H2. `is_featured` on English category pages always resolves to the first item, never an actually-featured one

**Location**: `frontend/src/app/en/category/[id]/[name]/page.tsx:52`

**Evidence**: `result.items.find((it) => it.is_featured === true) ||
result.items[0] || null`. The items come from `getCategoryPage()` →
`GET /api/v1/{locale}/articles?filter[category]=...`, which is served by
`PublicArticleListItemResource` — confirmed by direct backend read
(`app/Http/Resources/Public/Content/PublicArticleListItemResource.php:19-50`)
to **never serialize `is_featured`** (the underlying query selects the
column for internal ordering, but the Resource doesn't expose it). Since
`is_featured` is always `undefined` on every item, `.find(...)` always
returns `undefined`, and the page silently falls through to `items[0]` —
just the newest article in the category, every time.

**Cause**: the frontend field exists in `feed.ts`'s `FeedItem` type
(`is_featured?: boolean`, `feed.ts:44`) and is mapped in `mapItem()`
(`feed.ts:127`) but was never backed by a real backend field for
list/filtered endpoints — only the homepage's dedicated `hero` zone
(filtered server-side by `is_featured`) reflects that flag correctly.

**Impact**: low-visibility but real — the EN category page's "featured
article" hero slot never reflects actual editorial curation; it's
indistinguishable from "most recent."

**Proposed solution**: either have the backend add `is_featured` to
`PublicArticleListItemResource`, or remove the dead `.find()` on the
frontend and rely on `items[0]` directly (which is what happens anyway).

---

## Medium severity

### M1. `Article::canonicalPath()`'s docblock describes a URL scheme the code no longer implements

**Location**: `app/Models/Article.php:277-286` (backend, cited because it's
the root cause of a frontend-visible contract)

**Evidence**: the method returns `'/'.trim("{$locale}/article/{$id}", '/')`
— id-only, no slug. The docblock immediately above still reads (translated)
"stable hybrid canonical path: `/{locale}/articles/{id}-{slug}`" — the old
scheme. `git log -p -- app/Models/Article.php` shows commit `5b141d3c4`
changed the return value without touching the comment.

**Cause**: the URL scheme was deliberately simplified (confirmed
end-to-end: `frontend/src/app/(site)/article/[id]/page.tsx` is the complete
current article page, self-canonicalizes via `permanentRedirect` on numeric
ID alone, and `frontend/src/app/(site)/articles/[idslug]/page.tsx` — literally
named `OldArticlesRedirectPage` — exists solely to 301 the retired slugged
format to it) but the doc comment wasn't updated.

**Impact**: none on runtime behavior — purely a misleading comment for the
next developer who reads it. Flagged here because it's what led to a
now-corrected mischaracterization in this session's own backend closure
report (`docs/roadmap/PRODUCTION-GAP-CLOSURE-REPORT.md`, see its §3.2
correction) — worth fixing at the source so it doesn't mislead anyone else.

**Proposed solution**: update the docblock to match the actual id-only
scheme. One-line comment fix.

### M2. 5 backend tests assert the retired slugged canonical-URL contract

**Location**: `tests/Feature/PublicArticleSeoTest.php`,
`tests/Feature/Public/Content/ArticleRedirectTest.php`,
`tests/Feature/Public/Content/NewsSeoTest.php` (×2),
`tests/Feature/Public/SeoDeliveryTest.php`

**Evidence**: all 5 assert canonical/redirect/sitemap URLs in the
`/articles/{id}-{slug}-{hash}` shape; current backend + frontend behavior
(see M1) is `/article/{id}`. Reproduced and root-caused during this
session's Task G closure (see `PRODUCTION-GAP-CLOSURE-REPORT.md` §3.2) —
included here for completeness since it's the direct consequence of the
same URL-scheme change this frontend audit re-confirmed independently.

**Proposed solution**: update the 5 assertions to the current contract, or
remove them if the slugged format is permanently retired. Not fixed in this
session (out of scope for a read-only audit).

### M3. Category pages have no SEO metadata beyond a bare title

**Location**: `frontend/src/app/(site)/category/[id]/[name]/page.tsx:14-24`,
`frontend/src/app/en/category/[id]/[name]/page.tsx` (same pattern)

**Evidence**: `generateMetadata` returns only `{ title: category?.name }`.
No `description`, `canonical`, `openGraph`, `twitter`, or `robots`. No
JSON-LD anywhere on the page (confirmed by the page-inventory pass) despite
category pages having an obvious Home → Category hierarchy that would
support `BreadcrumbList` schema, and despite `articleSeoToMetadata()` /
`buildMetadata()` helpers already existing and used by nearly every other
page type in the site.

**Impact**: every category page — a primary, high-traffic, crawlable
surface — has no canonical URL declared (risk of duplicate-content
treatment across `?page=N` variants), no social preview (OG/Twitter), no
structured breadcrumb data, on both `ar` and `en`.

**Proposed solution**: build a category-specific `Metadata` object (title +
description from the category, `alternates.canonical`, `openGraph`) the
same way `pages/[slug]/page.tsx` does, and add `BreadcrumbList` JSON-LD the
same way `writer/[id]/page.tsx` does.

### M4. `lib/sport/*.ts` and `lib/reels.ts` aren't wrapped in React `cache()` — confirmed double-fetch on every sport detail page and the reel detail page

**Location**: `frontend/src/lib/sport/games.ts`, `stats.ts`, `player.ts`
(no `cache()` anywhere); `frontend/src/lib/reels.ts:139,166`
(`getReelsFeed`/`getReelByIdSlug` are plain `async function`, not
`cache()`-wrapped, unlike every other content-fetching module in `lib/`)

**Evidence**: every sport detail route
(`sport/competition/[id]`, `sport/match/[id]`, `sport/player/[id]`,
`sport/team/[id]`) calls its primary lookup once in `generateMetadata` and
again in the page body with identical arguments — confirmed by the
page-inventory pass, e.g. `sport/team/[id]/page.tsx:17` and `:25` both call
`getTeam(tid)`. Same pattern on `(reels)/reels/[idslug]/page.tsx:24` and
`:34` both calling `getReelByIdSlug(idslug)`. Without `cache()`, React's
per-request memoization doesn't apply, so both calls hit the network.

**Impact**: real, measurable — every sport-detail and reel-detail page load
does 2x the necessary backend calls for its primary data fetch (sport pages
compound this further, since several also re-derive secondary data from the
duplicated first call).

**Proposed solution**: wrap these functions in React's `cache()`, matching
every other `lib/*.ts` module's established pattern.

### M5. Root layout triggers `getSiteSettings()` from 4 separate call sites (deduped, but fragile)

**Location**: `frontend/src/app/layout.tsx` (`generateMetadata` →
`buildMetadata()`, plus `<ResourceHints/>`, `<Analytics/>`, `<JsonLd/>` each
independently calling `getSiteSettings()`), compounding with `(site)/layout.tsx`
and `(site)/page.tsx` each calling it again.

**Evidence**: page-inventory pass, confirmed `getSiteSettings` is
`cache()`-wrapped (`lib/site-settings.ts:115`), so today this dedupes to 1
actual fetch per request. Not a live performance bug.

**Impact**: none currently — flagged because it's fragile-by-convention: any
future call site that passes a different (even accidentally-different, e.g.
a typo'd default) argument silently loses the dedup and becomes a real
duplicate fetch, and there's no structural guard against that.

**Proposed solution**: none required urgently; consider fetching once in
the root layout and passing settings down via context/props if more call
sites accumulate.

### M6. `(site)/layout.tsx` fetches the full 5-zone homepage aggregate on every non-homepage page, to use 2 of the 5 zones

**Location**: `frontend/src/app/(site)/layout.tsx:22-26`

**Evidence**: `getHomepageFeed('ar')` (hero + breaking + header +
editors_pick + latest, per `BuildPublicHomepageAction.php:42-58`) is called
in the site-wide layout solely to destructure `{ latest, breaking }` for the
`NewsTicker`/`BreakingNewsBar`. Dedicated, lighter endpoints for exactly
this exist and are already used elsewhere: `getLatestFeed()` (`feed.ts:221`,
60s revalidate) and `getBreakingFeed()` (`feed.ts:227`, 120s revalidate).

**Impact**: not a backend-hammering issue (Next's Data Cache absorbs
repeat calls within the 120s homepage-aggregate revalidate window), but two
real effects: (1) the ticker's "latest" data is on a **staler** cache
window (120s via the homepage aggregate) than the dedicated `getLatestFeed`
would give it (60s); (2) three unused zones (hero, header, editors_pick) are
fetched and parsed on every single page view sitewide for no reason.

**Proposed solution**: replace with `Promise.all([getLatestFeed('ar'),
getBreakingFeed('ar')])` in the layout.

### M7. Three BFF route handlers hardcode `locale='ar'` — currently dormant, will break the moment EN gets these features

**Location**: `frontend/src/app/api/comments/route.ts:34`,
`frontend/src/app/api/live-updates/route.ts:19`,
`frontend/src/app/api/epaper/[idslug]/route.ts:19`

**Evidence**: all three build their backend URL with a literal `ar` path
segment; their `lib/` read-side counterparts (`comments.ts`, `articles.ts`'s
`getLiveUpdates`, `epaper.ts`) all accept a `locale` parameter, so the
inconsistency is isolated to these three write/proxy paths. Verified **not
currently reachable**: `en/article/[id]/page.tsx` renders no
`CommentSection` and calls no live-updates function; no `en/epaper` route
exists at all today (epaper is Arabic-only by design, matching
`broadcast.ts`'s explicit "Arabic-only/independent" note).

**Impact**: none today. Downgraded from what would otherwise be High because
it's confirmed dormant — but it's a pre-set trap: the day EN comments, EN
live-coverage, or EN epaper ships, it will silently write/read
Arabic-locale data for English users unless this is caught first.

**Proposed solution**: accept locale the same way the `lib/` counterparts
do, now, while it's cheap and low-risk (no behavior change today since EN
doesn't hit these paths yet).

### M8. `engagement-bff.ts` comment contradicts its own auth-requirement table

**Location**: `frontend/src/lib/engagement-bff.ts:19-25`

**Evidence**: inline comment states anonymous users can "like" an article
("allows anonymous for article, its current behavior"); the `REQUIRE_AUTH`
config immediately below sets `article: { react: true, favorite: true }` —
i.e., login is required for article reactions, contradicting the comment
directly above it.

**Impact**: no functional bug (the code, not the comment, governs runtime
behavior) — but a misleading comment in a security-relevant auth-gating
table is worth fixing before it misleads someone into believing anonymous
writes are allowed here.

**Proposed solution**: correct the comment to match `REQUIRE_AUTH`.

### M9. Zero `error.tsx`/`global-error.tsx` anywhere in the app; `(reels)` and `newspaper/[idslug]` have no `not-found.tsx` in their ancestor chain either

**Location**: entire `frontend/src/app` tree (confirmed absent by the
page-inventory pass); `(reels)/reels/[idslug]/page.tsx:38` and
`newspaper/[idslug]/page.tsx:40,44` both call `notFound()` with no custom
boundary to catch it.

**Impact**: if a server-side render throws an uncaught exception anywhere
(outside the lib layer's own disciplined try/catch-to-null pattern), every
route in the site falls back to Next's generic unstyled default error page
— no custom error UI exists at all. Separately, hitting a genuinely missing
reel or e-paper issue shows Next's default 404 rather than the site's
styled `(site)/not-found.tsx`, an inconsistent experience depending on
which section a user is in.

**Proposed solution**: add a root `error.tsx` (or at minimum one under
`(site)`), and a `not-found.tsx` for `(reels)` and for the `newspaper`
segment reusing the existing styled component.

---

## Low severity

### L1. Stale pre-rebrand fallback site name in the Reels feature

**Location**: `frontend/src/components/reels/reels-sidebar.tsx:15`,
`frontend/src/app/(reels)/reels/page.tsx:36`,
`frontend/src/app/(reels)/reels/[idslug]/page.tsx:58`,
`frontend/src/app/(site)/page.tsx:137` — all four identical:
`settings?.site_name || 'صدى الشعب الأخباري'`.

**Evidence**: the real, current brand is "القلعة نيوز" (confirmed as the
correct fallback everywhere else, e.g. `QalahFooter`,
`frontend/src/components/layout/qalah/footer.tsx:34`:
`settings?.site_name?.trim() || 'القلعة نيوز'`). "صدى الشعب الأخباري" appears
in exactly these 4 files, all specifically for the Reels player's site-name
watermark, nowhere else.

**Impact**: only triggers if `getSiteSettings()` fails or returns an empty
`site_name` (note: `||`, not `??`, so an empty string also triggers it) —
low probability, but if it fires, Reels-feature users see a completely
different, outdated company name.

**Proposed solution**: change all 4 to the same `'القلعة نيوز'` fallback
used everywhere else.

### L2. Inconsistent internal-auth-header usage across `lib/*.ts` read calls

**Location**: widespread — e.g. `categories.ts:46` (`getCategories`) and
`writer.ts:34` (`getWriterProfile`) send no headers at all, while
`writer.ts:75` (`getWriterArticles`) and nearly every other list-fetching
function send `headers: env.internalHeaders`.

**Evidence**: confirmed by direct reading and the secondary-modules research
pass — three distinct conventions coexist with no documented rule for which
endpoint gets which: `apiFetch`/Bearer (account/auth-flows),
`env.internalHeaders`/`X-Internal-Token` (most content lists), and no
headers at all (`categories.ts`, `getWriterProfile`, `auth-config.ts`,
`recaptcha.ts`, `tts.ts`, `site-settings.ts`, `static-pages.ts`,
`engagement.ts`'s `getArticleMetrics`).

**Impact**: `X-Internal-Token` exists specifically to bypass the backend's
120 req/min `throttle:public.read` limiter for server-to-server SSR calls
(confirmed: `AppServiceProvider.php:422-434`, `Limit::none()` on a valid
token). The calls missing this header are not exempted — under heavy
concurrent SSR load they compete for the same 120/min-per-IP budget as real
end users, unlike their siblings.

**Proposed solution**: add `env.internalHeaders` to the handful of read
calls currently missing it, for consistency with the rest of the codebase's
own established pattern.

### L3. Locale passed three different ways across `lib/*.ts`

**Location**: path segment (`/api/v1/{locale}/...`, the majority
convention) vs. query string (`site-settings.ts:119` `?locale=`,
`categories.ts:65` `getArticleCategories`) vs. no locale concept at all
(`broadcast.ts`, `engagement*.ts`, `follow*.ts` — the latter two by
design, documented).

**Impact**: cosmetic/maintainability only — every case reaches the correct
endpoint. Worth normalizing only opportunistically, not urgently.

### L4. Non-functional app-store buttons in the footer

**Location**: `frontend/src/components/layout/qalah/footer.tsx:126-133`

**Evidence**: `<a href="#" className="app-btn">` for both "Android" and
"iPhone" download buttons — no real store URL, no CMS field backing them.

**Impact**: low but real — a user tapping "Download for Android/iPhone" in
the footer gets a dead `#` link with no feedback.

**Proposed solution**: either link real store URLs once the apps exist, or
remove the buttons until then.

### L5. Duplicated dev-only cache helper defined verbatim in two files

**Location**: `frontend/src/lib/site-settings.ts:6-29` and
`frontend/src/lib/reels.ts:6-28` — byte-identical `getCached`/`apiCache`
implementations, each independently defined (also present with the same
shape in `feed.ts`, a third copy).

**Impact**: none functionally (each keys its own `globalThis` map by a
distinct cache key) — pure maintainability duplication.

**Proposed solution**: extract to one shared helper, e.g.
`lib/dev-cache.ts`.

### L6. Hardcoded-Arabic output on third-party integrations regardless of site locale

**Location**: `frontend/src/lib/weather.ts:91,106` (`lang=ar` hardcoded in
both OpenWeather URLs) and `:116-118` (`Intl.DateTimeFormat('ar', ...)`
labels); `frontend/src/lib/gold.ts:75-83` (karat/lira labels as hardcoded
Arabic string literals, no locale parameter on any exported function).

**Impact**: an English-locale reader hitting `/weather` or `/gold-prices`
(neither currently has an `/en` counterpart route, per the page inventory,
so this is not yet reachable from a live EN page — but both `lib` modules
have zero locale plumbing, so it would surface immediately if either page
gained an EN route) would see Arabic weather descriptions/gold-karat labels
on an otherwise-English page.

**Proposed solution**: no urgency while EN routes for these don't exist;
worth a note for whoever adds them.

### L7. `en/author/[id]/page.tsx` double-fetches with different limits (not deduped despite `cache()`)

**Location**: `frontend/src/app/en/author/[id]/page.tsx:19` (`generateMetadata`,
`getAuthorArticles(id, 1, 'en')`) vs. `:28` (page body,
`getAuthorArticles(authorId, 24, 'en')`).

**Impact**: `cache()` keys on the full argument list, so the differing
`limit` (1 vs 24) means these are two genuinely separate upstream calls, not
a dedup failure — but the `limit:1` call in `generateMetadata` fetches a
full article payload just to read `articles[0]?.author?.name` for the page
title.

**Proposed solution**: minor; could fetch just the writer's name via a
lighter call, or accept the small inefficiency as-is.

### L8. `/search` title never reflects the actual query

**Location**: `frontend/src/app/(site)/search/page.tsx:12-15`

**Evidence**: uses a static `export const metadata` object (title fixed,
`robots:{index:false,follow:true}`), not `generateMetadata()` — confirmed
by the page-inventory pass as one of several pages using this pattern, but
`/search` is the one where it matters most: every search results page
(`/search?q=anything`) shares one generic `<title>`, never including the
query itself. `robots: noindex` on this route makes the SEO impact minor,
but the browser-tab/bookmark/share UX impact (a user with 5 search-result
tabs open sees 5 identical titles) is real regardless of indexing.

**Proposed solution**: convert to `generateMetadata({ searchParams })` and
include the query in the title, e.g. `` `نتائج البحث: ${q}` ``.

### L9. Dead placeholder-content module still wired into a documented rollback path

**Location**: `frontend/src/components/layout/nav-data.ts:1-3,7-46`
(explicit comment: "Static placeholder content for the Phase-1 shell...
BREAKING... Placeholder(a) لا يأتي من الباك إند" — sample/dummy breaking-news
text, `#`-only nav links)

**Evidence**: `BREAKING`/`MAIN_NAV`/`MORE_NAV`/`FOOTER_SECTIONS` are **not**
imported by any currently-active component (`QalahHeader`/`QalahNavbar`/
`QalahFooter`/`QalahMenu` only import the legitimate `SECTIONS_NAV`, which
has real routes). They're imported only by `main-nav.tsx`, `site-footer.tsx`,
`mobile-nav.tsx`, `breaking-bar.tsx` — the pre-Qalah-rebrand "old shell",
which `(site)/layout.tsx:19-20`'s own comment documents as a live rollback
path ("Rollback to old shell: swap Qalah* for SiteHeader/SectionsBar/
SiteFooter... old components still in place").

**Impact**: not reachable today — verified, not a live bug. But the
documented rollback path currently leads to placeholder/dummy content
(fake breaking-news text, dead `#` nav links) if it's ever actually
exercised.

**Proposed solution**: if the old shell is still a genuine rollback option,
update `nav-data.ts`'s placeholder arrays to real data; if the rollback
path is no longer needed, remove the old shell components and this file's
dead exports together.

---

## Verified – No Issues Found

- **`PublicWriterResource` ↔ `writer.ts`'s `WriterSchema`**: exact 1:1 field
  match (`id, name, avatar, bio, social_links`) — no unused backend fields,
  no missing frontend expectations.
- **`filter[category]` (slug-only, no `filter[category_id]`)**: the
  frontend's category-tree caching workaround in `feed.ts` (documented in
  its own comment as compensating for this backend limitation) is
  confirmed still accurate — no public id-based category lookup exists
  anywhere on the backend.
- **`flags.spotlight` naming**: the backend's detail resource exposes
  `is_editor_pick` under the JSON key `spotlight` (`PublicArticleResource.php`);
  the frontend's `ArticleSchema` (`articles.ts:158-166`) correctly
  anticipates this exact naming — not a bug, matches perfectly.
- **Live-updates ETag/304 polling**: built correctly end-to-end — the
  backend's fingerprint-based ETag (`ListPublicLiveUpdatesAction`) is
  actually consumed via `If-None-Match` passthrough in
  `app/api/live-updates/route.ts`, which is what the *client-side poller*
  uses; the initial SSR fetch in `lib/articles.ts`'s `getLiveUpdates`
  correctly does *not* need ETag handling since it's a one-shot render, not
  a poll. Both halves match their actual use case.
- **In-memory dev cache disabled in production**: `getCached()`'s
  `NODE_ENV==='production'` bypass (present identically in `feed.ts`,
  `site-settings.ts`, `reels.ts`) is deliberate and correctly implemented —
  confirmed via git history as a previously-landed fix
  (`1b4c74c07 fix(frontend): restrict memory cache to development only`),
  still intact.
- **Footer placeholder-link filtering**: `PLATFORM_LINKS` in `nav-data.ts`
  contains two `href: '#'` placeholder entries (Writers, Careers), but
  `QalahFooter` (`footer.tsx:50`) explicitly filters `.filter(l => l.href
  !== '#')` before rendering — the dead links are never actually shown.
  Verified by tracing the full path, not assumed from the array alone.
- **`ArticleSchema`'s defensive `looseArray` preprocessor**: correctly
  compensates for a real, documented backend serialization asymmetry
  (`PublicArticleResource` returns `whenLoaded(...->values())`, a
  Collection, for some array fields vs `->all()` for others) — verified
  as intentional, working defensive coding, not a workaround masking a bug.

---

## Coverage note

This pass covered the full API layer (all ~33 fetching `lib/` modules + all
30 BFF route handlers), the complete page/layout inventory (every route
under `(site)`, `en`, `(reels)`, `newspaper`), the site shell
(header/footer/nav), the homepage, and a deep trace of the article
canonical-URL/SEO contract against the Laravel source. It did **not**
include a live-browser pass over every one of the ~45 routes for visual
consistency (card-component identity, spacing, date-format rendering),
responsive breakpoints, or accessibility — those would need
`preview_*`-driven verification page-by-page, which is a large enough
follow-up to scope separately if wanted. Everything reported above is
traced to source, not inferred from typical patterns.
