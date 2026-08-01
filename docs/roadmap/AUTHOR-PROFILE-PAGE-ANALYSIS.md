# Author Profile Page — Architectural Analysis & Implementation Plan

**Status: Phase 1 (Backend), Phase 2 (Frontend Data Layer), and Phase 3 (UI
rebuild) implemented and tested — 2026-07-22. Phase 4 (SEO) not started; user
gates each phase behind a tested prior phase, per explicit instruction.**

**Original status when this document was first written: analysis complete,
approved. No code has been changed in this pass** —
this document is the record of a four-round, evidence-based investigation
conducted before any implementation, per explicit instruction. Every finding
below cites file + line (backend paths are repo-root-relative, frontend paths
are `frontend/`-relative); nothing is asserted from memory of typical
Laravel/Next.js patterns.

**Scope**: the Author Profile page only, currently at `/news/writer/[id]`
(e.g. `/news/writer/2`). The left sidebar (Latest News / WhatsApp /
Advertisement widgets) and all other pages are explicitly out of scope.

**Method**: direct reading of the full rendering chain (frontend route →
loader → API → backend controller → action → resource → model → migration),
plus four rounds of targeted research agents covering: (1) initial full-stack
trace, (2) three redesign-blocking questions raised after round 1 (URL
design, dedicated endpoint, layout-reuse boundary, full author-link audit),
(3) three refinements requested after round 2 (backend slug as single source
of truth, thin-wrapper endpoint feasibility, broader indirect-URL audit).

---

## 1. Current rendering flow

```
/news/writer/[id]
  → frontend/src/app/(site)/news/writer/[id]/page.tsx   (async Server Component)
      → generateMetadata()               — title/description only, no canonical/OG/Twitter/JSON-LD
      → getWriterProfile(id)             — frontend/src/lib/writer.ts:31-51, React cache()-deduped
          → GET {API}/api/v1/{locale}/writers/{id}
              → routes/api/v1/public.php:77
              → App\Http\Controllers\Api\V1\Public\Content\WriterProfileController::show
              → App\Actions\Public\Content\ShowPublicWriterAction::handle()
                  User::whereKey($id)->where('is_writer', true)->where('status', 'active')->first()
                  → 404 if not found / not a writer / inactive
              → App\Http\Resources\Public\PublicWriterResource::toArray()
      → render: avatar/name/social badges, bio section, "back home" link
```

**Critical gap confirmed**: the page fetches only the profile. **No article
list is fetched or rendered today** — no pagination, no load-more, nothing.
The entire page body is ~60 lines of JSX (`page.tsx:34-93`).

There is **no dedicated `Writer`/`Author` model** — writers are
`App\Models\User` rows with `is_writer = true`. Articles reference the
writer via `articles.author_id → users.id`.

---

## 2. Current data model

### `users` table — ground truth (all 6 migrations touching `users` read in full)

`id, name, email (unique), password, remember_token, status, last_login_at,
last_login_ip, avatar (string), bio, social_links (json), deleted_at,
is_writer, phone, whatsapp_subscribed, created_at, updated_at`

No `slug`, no `job_title`/`position`, no stored `article_count`, no
`is_verified`, no `website` field, no cover/banner image collection.

### What `GET /writers/{id}` returns (`app/Http/Resources/Public/PublicWriterResource.php:19-34`)

| Field | Source | Status |
|---|---|---|
| `id`, `name` | column | OK |
| `slug` | `Str::slug($name)`, computed per-request | Inconsistent method — see §5 |
| `url` | hardcoded `"/writer/{id}"` | **Bug** — doesn't match real route `/news/writer/{id}` |
| `avatar` | Spatie MediaLibrary `avatar` collection | Diverges from article-byline avatar source (§5) |
| `bio`, `social_links` | column | OK |
| `articles_count` | `whenCounted('articles')` | **Bug — always empty on this endpoint** (§5) |
| `last_activity_at` | `whenHas(...)` | **Bug — always empty on this endpoint** (§5) |
| `verified` | `$this->is_verified ?? false` | **Dead code** — no such column exists anywhere; always `false` |

### Frontend `WriterProfile` type (`frontend/src/lib/writer.ts:23-29`)

Narrower still: only `id, name, avatar, bio, social`. Drops `slug`/`url`
even though the backend already sends `slug` — nothing in the frontend
currently reads it.

---

## 3. Bugs found during the trace (fix as part of implementation, not separately)

1. `ShowPublicWriterAction` never calls `withCount('articles')` /
   `withMax('articles as last_activity_at', ...)`, unlike the sibling
   `ListPublicWritersAction` (`app/Actions/Public/Content/ListPublicWritersAction.php:27-28`)
   — so `articles_count`/`last_activity_at` are silently empty on the
   single-profile endpoint.
2. `verified` reads a non-existent `is_verified` attribute — permanently
   `false`, dead code (`PublicWriterResource.php:32`).
3. Avatar source mismatch: the profile endpoint uses Spatie media
   (`avatar` collection); article-byline avatar uses the plain
   `users.avatar` string column via `Article::authorAvatarUrl()`
   (`app/Models/Article.php:315-318`). These can diverge for the same writer.
4. Resource's `url` field (`/writer/{id}`) doesn't match the real frontend
   route (`/news/writer/{id}`).
5. `generateMetadata()` (`page.tsx:20-25`) bypasses the shared
   `buildMetadata()` helper every other content page uses
   (`frontend/src/lib/seo.ts:37`) — returns no `alternates` key, so the page
   likely inherits the **homepage's canonical URL** via Next.js metadata
   merging. No canonical override exists at all today (confirmed again in
   round 3, §7).
6. Slug is computed on the fly, not stored/unique — two writers with
   similar names could produce colliding decorative slugs (acceptable only
   because the id remains the actual lookup key — see §6).

---

## 4. Existing reusable components

| Need | Component | Path |
|---|---|---|
| Article card | `NewsListItem({item, variant, isFirst})` | `frontend/src/components/feed/news-list-item.tsx:10-18` |
| Share | `ShareButtons({url, title, className})` | `frontend/src/components/share/share-buttons.tsx:28` |
| Social icons + mapping | `socialEntries()`, branded icon set | `frontend/src/components/layout/social-map.ts:14-37`, `frontend/src/components/icons/social.tsx` |
| Latest News sidebar | `ReadingSidebar` → `SidebarNewsWidget` → `NewsTabs` | `frontend/src/components/reading/reading-sidebar.tsx:8-15` |
| WhatsApp widget | `SubscribeBox({variant})` | `frontend/src/components/public-forms/subscribe-box.tsx:21` |
| Ads | `AdZone({zone})` | `frontend/src/components/ads/ad-zone.tsx` |
| Load-more mechanics (pattern, not component) | `CategoryLoadMoreFeed` | `frontend/src/components/category/category-load-more-feed.tsx:15-25` |

**Confirmed NOT reusable / must stay category-specific** (read directly,
round 2): `CategoryDefaultHeader` is a private, unexported function local to
`news/category/[...segments]/page.tsx:24`, driven by
`category.appearance.show_title`/`.banner` — config that doesn't exist for
writers. `SectionRenderer` + `CategoryFeaturedGrid`
(`frontend/src/components/sections/SectionRenderer.tsx`) implement a
`hero`/`magazine`/`featured` layout system driven entirely by
`category.appearance.layout` — also category-only config. **There is no
risk of "cloning the category page"** by reusing components — the top
section genuinely doesn't transfer; a new `WriterProfileHeader` must be
built from scratch, while the article-list portion reuses `NewsListItem`
and the load-more *mechanics* (not the component as-is, since it's
hardcoded to a category `slug` prop).

Sidebar note: **the writer page currently has no `<aside>`, no grid — a
single centered column.** "Leave the sidebar unchanged" therefore means
either adding `ReadingSidebar`/`AdZone`/`SubscribeBox` for the first time
(unmodified, as category pages use them) or staying single-column — this is
a scope call, not yet locked in.

---

## 5. Approved decision: URL format — id-slug composite

**Decision: `/news/writer/{id}-{slug}`** (e.g. `/news/writer/2-ahmad-alrawashdeh`),
mirroring `Article::canonicalPath()`'s own 2026-07-18 redesign, whose
docblock states the id-only canonical form exists so "slug stays
decorative, freely editable, without ever breaking an existing link."

| | id-only (today) | pure slug | **id-slug (chosen)** |
|---|---|---|---|
| SEO | Weakest | Best | Same as pure slug |
| Breaks on rename | No | Yes, without new redirect infra | **No** |
| New DB work | None | New column + unique index + collision policy | **None** |
| Lookup cost | PK lookup | New indexed `where('slug', ...)` | **Same PK lookup as today** |

`users` has no locale scoping (unlike `articles`/`categories`), so pure-slug
would need a from-scratch collision policy for duplicate/transliterated
Arabic names plus a redirect-history mechanism — neither exists for users
today (`article_url_history`/`ArticleRedirectResolver` are Article-specific).
Id-slug needs none of that: the id resolves the row exactly as it does
today; the slug segment never touches the database, same pattern as
`ShowPublicArticleAction::resolveId()` (`app/Actions/Public/Content/ShowPublicArticleAction.php:95-110`,
`preg_match('/^(\d+)-/', ...)`).

### Backend slug becomes the single source of truth (refinement, round 3)

The frontend must **not** compute `Str::slug(name)` independently anywhere
(rejected explicitly — risk of divergent output if display-name formatting
changes, e.g. an added title prefix). Smallest backend change:

1. Add `getSlugAttribute()` to `App\Models\User`, reusing the existing
   generic, Arabic-safe `App\Support\Content\SlugGenerator::makeWithFallback($this->name)`
   (`app/Support/Content/SlugGenerator.php`) — pure string normalization, no
   DB queries, no migration needed (computed accessor, not a stored column;
   cheap enough per-request that storing/caching it is unnecessary).
2. `PublicWriterResource.php:21,25` — replace the inline `Str::slug()` call
   with `$this->slug`, so the profile endpoint uses the shared accessor.
3. Add `'slug' => $this->author?->slug` wherever a writer is embedded as an
   article's author:
   - `app/Http/Resources/Public/Content/PublicArticleListItemResource.php:38-45`
   - `app/Http/Resources/Public/Content/PublicArticleResource.php:52-60`
   - `app/Http/Resources/Public/Content/PublicLiveUpdateResource.php:30-32`
     (this one is also currently missing the author's `id` entirely — must
     add both, since a link needs `id`, and the slug alone can't resolve a
     writer).

One implementation, called from one accessor, consumed everywhere — no
frontend-side slug computation anywhere, ever.

---

## 6. Approved decision: Writer Articles endpoint — thin wrapper, not a new query engine

**Decision: add `GET /writers/{id}/articles`** as a genuinely thin
controller delegating to the existing `ListPublicArticlesAction` — chosen
for API clarity, while confirmed not to require duplicating the Action's
~300 lines of pagination/cursor/search/eager-load logic.

Traced `ListPublicArticlesAction::handle(string $locale, Request $request)`
(`app/Actions/Public/Content/ListPublicArticlesAction.php:35`) — it reads
filters from the request object, and the internally-used
`Spatie\QueryBuilder` resolves the *same* container-bound `Request`
singleton the controller receives. A controller can therefore mutate the
shared request's `filter.author_id` before delegating, with **zero changes
to the Action**:

```php
public function index(Request $request, string $locale, int $id): JsonResponse
{
    $writerCheck = (new ShowPublicWriterAction)->handle($id);   // reuse existing 404 gate
    if ($writerCheck->getStatusCode() === 404) return $writerCheck;

    $filters = $request->query('filter', []);
    $filters['author_id'] = (string) $id;                       // route id always wins
    $request->merge(['filter' => $filters]);

    return (new ListPublicArticlesAction)->handle($locale, $request);
}
```

- Preserves any other client-supplied filters (`merge()` replaces the whole
  `filter` array, so the wrapper must read-then-write, not blind-merge —
  confirmed via `Illuminate\Http\Request::merge()` semantics).
- Reuses `ShowPublicWriterAction` for the existence/active gate instead of
  duplicating its 3-clause `where` — zero duplicated SQL.
- Reuses the existing `->whereNumber('id')` route constraint pattern from
  `routes/api/v1/public.php:77` for consistent 404-on-non-numeric-id
  behavior.
- **Total diff: 1 new controller (~15-20 lines) + 1 route line.** Zero
  changes to `ListPublicArticlesAction` or `AllowedFilter::exact('author_id')`.

**Precedent check**: Categories — the one comparable "entity that owns
articles" in this codebase — never got a dedicated nested route either;
`GET /categories/{path}` returns only category metadata, and category
article lists go through the same generic `/articles?filter[category]=`
endpoint. The category precedent is why the caching layer already has a
`category` tag dimension (`app/Support/Cache/ArticleCacheTags.php:49-52,88-91`)
but **no `author` dimension exists yet** — confirmed fresh in round 3, file
still only has `feed`/`detail`/`category`. This is a **separate, optional
follow-up** (mirror the `category()`/`authorTags()` pattern, wire into
`writeTags()` and `ListPublicArticlesAction.php` lines ~60-63/~241-244) —
not a blocker for shipping the route; without it, author-filtered lists
stay tagged under the broader `feed(locale)` tag, exactly as they are today
under the generic-filter approach, so nothing regresses.

---

## 7. Complete author-link audit (two rounds, both confirmed exhaustive)

**Only two places in the entire frontend build an author-profile URL:**

| File:line | Context | Href built |
|---|---|---|
| `frontend/src/components/articles/article-detail.tsx:44` | Opinion-article byline | `` `/writer/${article.author.id}` `` |
| `frontend/src/components/home/opinion-writers-carousel.tsx:65` | Homepage opinion-writers carousel | `` `/writer/${author.id}` `` |

Both use the short form `/writer/{id}`, resolved today via a permanent
redirect in `next.config.ts` (`/writer/:path*` → `/news/writer/:path*`).

Round 2 searched for the literal `/writer/` substring; round 3 re-searched
broadly for `author.id`/`author.url`/`author.slug`, every `router.push`/
`useRouter()` call (9 found, all unrelated — login/account/gold-price
flows), every `href`/`<Link>` built from author-shaped variables, generic
helper-naming patterns (`generateAuthorUrl` etc. — none exist), canonical-URL
utilities, sitemap generation, and JSON-LD. Confirmed negative on all of
them:

- The backend's `PublicWriterResource.url`/`.slug` fields are **not
  consumed anywhere in the frontend today** — `lib/writer.ts`'s
  `WriterSchema` doesn't parse them, so today's buggy hardcoded `url` field
  can't leak an inconsistent link (nothing reads it).
- **No sitemap entry exists for writers at all** — the backend's
  `team.xml` sitemap route is an unrelated `TeamMember` (staff bio) object,
  not writer profiles. Ruled out directly, not a false negative.
- **No JSON-LD anywhere embeds an author profile URL.** The one Open Graph
  `article:author` field carries a plain name, not a link
  (`frontend/src/lib/articles.ts:370` ← `app/Support/Content/PublicSeoBuilder.php:65,280`).
- `admin-frontend` has only static documentation text referencing the
  `/writer/` path pattern (a Cloudflare cache-rule copy-paste helper),
  not a functional URL builder.

**Consequence for implementation**: only these two href builders need to
change to `` `/news/writer/${id}-${slug}` `` once the URL format ships.
Since the embedded `author` objects at both call sites
(`ArticleDetail.author` / `FeedItem.author`, `frontend/src/lib/articles.ts:40`,
`frontend/src/lib/feed.ts:18`) will carry a backend-supplied `slug` per §5,
no client-side slug computation is needed at either site.

---

## 8. Other current-state findings (SEO / performance / accessibility)

**SEO**: no canonical override, no OpenGraph, no Twitter Card, no JSON-LD
`Person`, no JSON-LD `BreadcrumbList`, no per-writer `robots` handling — all
confirmed absent by direct file read of `page.tsx` (round 1) and
re-confirmed in round 3 while checking canonical-URL utilities. The correct
pattern already exists elsewhere (`articleSeoToMetadata()`,
`frontend/src/lib/articles.ts:338-380`) and should be the template.

**Performance**: 7 distinct fetches on initial load today (3 server:
site-settings, match-bar, writer-profile; 4 client: one per `AdZone`
instance in global header/footer). Adding an article list + `ReadingSidebar`
would add ~4-5 more, matching what category pages already pay. Codebase-wide
policy is plain `<img>`, never `next/image` — not a page-specific issue.

**Accessibility**: current state is solid — correct `alt`, correct
`aria-hidden` on decorative icons, valid `h1`→`h2` hierarchy. Gap: social
links render as raw platform-key text rather than branded icons; if
redesigned to icon-only badges via `socialEntries()`, each needs an
`aria-label` (pattern already exists in `share-buttons.tsx:66,79,90`).

---

## 9. Missing backend fields (genuinely absent, confirmed via full migration read)

`job_title`/`position`, a stored `article_count` (only computable via
`withCount`), a follower/"follow this writer" feature (existing `Follow`
model is scoped to sports entities only, unrelated), a real verified-badge
column, a discrete `website` field, a cover/banner image collection,
specialization/beat tags, a per-writer total-views aggregate. Unused but
available: `created_at` exists but is never serialized — could power a
"member since" display for free.

---

## 10. Implementation plan (approved scope, sequencing)

1. **Backend — slug single source of truth** (§5): `User::getSlugAttribute()`
   + update `PublicWriterResource` + add `slug` (and `id` where missing) to
   the three author-embedding resources.
2. **Backend — fix known bugs** (§3): `withCount`/`withMax` on
   `ShowPublicWriterAction`, remove/fix dead `verified` field, fix `url`
   field or drop it now that id-slug hrefs are built client-side from `id`+`slug`.
3. **Backend — `GET /writers/{id}/articles`** (§6): thin `WriterArticlesController`
   + route registration.
4. **Frontend — route rename** to `[idslug]` (mirroring the article route's
   `bareId()` parsing pattern) to accept `{id}-{slug}`, with mismatch →
   `permanentRedirect()` to the true canonical, matching the article/category
   precedent.
5. **Frontend — rebuild the author header** (new, author-specific
   component — not derived from `CategoryDefaultHeader`): avatar, name, bio,
   article count (now populated per step 2), `ShareButtons` reuse,
   `socialEntries()` + branded icons reuse.
6. **Frontend — article feed**: fetch `GET /writers/{id}/articles`, render
   via `NewsListItem` (identical to category pages), load-more using the
   `CategoryLoadMoreFeed` *pattern* (new BFF route needed, e.g.
   `app/api/writer/[id]/articles/route.ts`, mirroring the category one).
7. **Frontend — SEO**: route `generateMetadata()` through `buildMetadata()`;
   add JSON-LD `Person` + `BreadcrumbList`, following
   `articleSeoToMetadata()`'s pattern.
8. **Frontend — update the two href builders** (§7): `article-detail.tsx:44`,
   `opinion-writers-carousel.tsx:65` → build `/news/writer/{id}-{slug}` from
   the now-available `author.slug`.

**Open scope decision, still pending your call**: whether to add
`ReadingSidebar` + `AdZone("ads_in_side")` + `SubscribeBox` to this page for
the first time (§4) — affects whether the redesign is single- or
two-column.

---

## 11. Phase 1 (Backend) — implemented and tested, 2026-07-22

All items shipped exactly per the approved plan, no scope beyond it:

- `App\Models\User::getSlugAttribute()` added, delegating to
  `SlugGenerator::makeWithFallback($this->name)` — no migration, no DB column.
- `PublicWriterResource` — uses `$this->slug` (shared accessor, no inline
  `Str::slug()`); `url` now `"/news/writer/{$this->id}-{$this->slug}"`.
- `PublicArticleResource`, `PublicArticleListItemResource` — `author.slug`
  added.
- `PublicLiveUpdateResource` — `author.id` and `author.slug` added (was
  missing `id` entirely).
- `ShowPublicWriterAction` — `withCount('articles')` +
  `withMax('articles as last_activity_at', 'published_at')` added, matching
  `ListPublicWritersAction`.
- `WriterArticlesController::index()` (new file) — thin wrapper: reuses
  `ShowPublicWriterAction` for the 404 gate, force-merges `filter.author_id`
  onto the shared `Request`, delegates to `ListPublicArticlesAction`
  unchanged. Route: `GET /{locale}/writers/{id}/articles`, `->whereNumber('id')`.

**Live-tested against the local Docker stack** (`shaabjo-backend-1`, id=2 is
the same writer as the original brief's `/news/writer/2`):

| Check | Result |
|---|---|
| `GET /ar/writers/2` | `slug: "كتاب-صدى-الشعب"` (Arabic-preserving), `url: "/news/writer/2-كتاب-صدى-الشعب"`, `articles_count: 79757`, `last_activity_at` populated |
| `GET /ar/writers/2/articles` | Returns paginated articles; each `author` object carries `id`/`slug` |
| `GET /ar/writers/999999/articles` | `404` (nonexistent writer — 404 gate reused correctly) |
| `GET /ar/writers/abc/articles` | `404` (non-numeric id — route constraint) |
| `GET /ar/writers/2/articles?filter[author_id]=999999` | `total: 79757`, `author.id: 2` — **route id conclusively wins over a spoofed client filter** |
| `GET /ar/articles?filter[author_id]=2` (existing generic filter, unchanged) | `author.slug` now present — confirms the fix is consistent across both access paths |
| `GET /ar/articles/{id}` (detail) | `author.slug` present |
| `GET /ar/writers` (directory list) | `slug`/`url` correct in collection context too |
| Regression: `GET /ar/articles`, `GET /ar/writers` (unfiltered) | both `200 OK` |

**Not live-verified**: `PublicLiveUpdateResource`'s `author.id`/`slug` fields
— the local dataset has zero `live_updates` rows with a non-null
`author_id`, so the `whenLoaded('author', ...)` closure never fires against
real data. Verified instead via direct code read (identical pattern to the
two resources proven live above) and confirmed the eager-load already
selects `id` (`ListPublicLiveUpdatesAction.php:92`,
`->with(['author:id,name', ...])`), so the field will populate correctly
once a live update with an author exists.

**Testing method note**: the running `shaabjo-backend-1` container is built
from a baked image (only `storage/app/public` and an uploads volume are
mounted — confirmed via `docker inspect`), not a live bind-mount of source.
Edited files were `docker cp`'d into the running container and the
container restarted (clears `opcache.validate_timestamps=Off`, which
otherwise silently serves stale bytecode) purely to exercise real HTTP
requests against the real database for this test pass. The source of
truth remains the files on disk under `app/`/`routes/` — a normal
image rebuild will pick up the same content.

Ready for Phase 2 (Frontend Data Layer) on your go-ahead.

---

## 12. Phase 2 (Frontend Data Layer) — implemented and tested, 2026-07-22

Scope per §10 items 4 and 8 only (route rename/redirect + the two href
builders) — items 5-7 (header rebuild, article feed, SEO) are Phase 3/4,
untouched.

- `lib/writer.ts` — `WriterProfile.slug: string` added (schema + mapping);
  backend's `getSlugAttribute()` remains the only place a slug is computed.
- `lib/articles.ts` / `lib/feed.ts` — `author.slug` added to both the Zod
  schema and the mapped `ArticleDetail`/`FeedItem` types, per §5 item 3.
- Route renamed `news/writer/[id]` → `news/writer/[idslug]`, mirroring
  `news/[dd]/[mm]/[yyyy]/[idslug]`'s `resolveCanonical()` pattern: fetch by
  the leading numeric id, compare the full decoded segment against
  `{id}-{slug}`, `notFound()` if the writer doesn't exist, `permanentRedirect()`
  (308) if the segment doesn't match exactly.
- `article-detail.tsx:44` and `opinion-writers-carousel.tsx:65` — both href
  builders now emit `/news/writer/{id}-{slug}` (falling back to bare `{id}`
  if `slug` is ever null, which still resolves correctly via the redirect
  above — never a broken link).

**Real bug found and fixed during live testing (not theoretical — confirmed
via `docker logs`):** the initial implementation passed the raw Arabic slug
straight into `permanentRedirect()`. Node's `http.ServerResponse.setHeader`
rejects non-ASCII bytes in header values, so every redirect crashed with
`TypeError: Invalid character in header content ["location"]` → a 500 on
`/news/writer/2`, not the intended 308. Fixed by `encodeURIComponent()`-ing
just the slug segment before building the `Location` target — this exact
rule was already documented (and evidently already learned the hard way
once) in `(site)/category/[slug]/page.tsx:20`: *"encodeURIComponent إلزاميّ
— slug عربيّ خام بترويسة Location يُسقِط الخادم"*. Should have been caught by
checking that precedent before writing the redirect, not after a crash —
noted for next time.

A second, related bug surfaced immediately after the encoding fix: comparing
the **raw** (still percent-encoded) `idslug` route param against the
**decoded** `{id}-{slug}` string made `isCanonical` false even for the exact
canonical URL, so `/news/writer/2-كتاب-صدى-الشعب` redirected to itself forever
(confirmed via `curl -D -` showing a 308 back to the identical target with
`x-nextjs-cache: HIT`). Fixed by decoding `idslug` once up front and using
that single decoded value for both the id-extraction regex and the
canonical-equality check.

**Live-tested against the local Docker stack** (frontend image rebuilt,
`frontend-cache` volume cleared to rule out stale ISR entries from before
this change):

| Check | Result |
|---|---|
| `GET /news/writer/2` (id only) | `308` → `Location: /news/writer/2-%D9%83%D8%AA%D8%A7%D8%A8...` (percent-encoded Arabic slug) |
| `GET /news/writer/2-كتاب-صدى-الشعب` (canonical, percent-encoded) | `200`, page renders، writer name present in HTML |
| `GET /news/writer/2-wrong-slug` (stale/incorrect slug) | `308` → redirects to the correct canonical slug |
| `GET /news/writer/999999` (nonexistent writer) | `404` |
| `GET /news/writer/abc` (non-numeric) | `404` |
| Opinion article `GET /news/25/06/2026/347889` | byline renders `href="/news/writer/2-كتاب-صدى-الشعب"` — confirms `article-detail.tsx`'s href builder end-to-end against live data |
| `tsc --noEmit`, `eslint`, `next build` | all clean, `/news/writer/[idslug]` builds as `●` (SSG via `generateStaticParams`), not `ƒ` (fully dynamic) — confirms the ISR-preservation trick still holds |

**Not live-verified:** the homepage `OpinionWritersCarousel` href (no opinion
writers section had content on this dataset at test time — code path is
identical to the article-detail one already proven live, just a different
call site consuming the same `FeedItem.author.slug` field).

Ready for Phase 3 (UI rebuild: author header + article feed) on your
go-ahead.

---

## 13. Phase 3 (UI Rebuild) — implemented and tested, 2026-07-22

Open scope decision from §4 resolved: **sidebar added** (two-column, matching
category pages) — user's explicit call, not a default assumption.

- `WriterProfileHeader` (new, `components/articles/writer-profile-header.tsx`)
  — built from scratch as flagged in §4 (not derived from
  `CategoryDefaultHeader`, which is config-driven off `category.appearance`
  that doesn't exist for writers). Avatar, "كاتب" badge, name, **article
  count** (now real — `formatNumber(writer.articlesCount)`, populated by the
  Phase 1 `withCount` fix), social links upgraded from raw platform-key text
  to branded icons via `socialEntries()` (the accessibility gap noted in §8),
  and `ShareButtons` reuse.
- `WriterArticlesFeed` (new, `components/articles/writer-articles-feed.tsx`)
  — a sibling copy of `CategoryLoadMoreFeed`'s exact pattern (not a shared
  abstraction — per §10 item 6, "using the *pattern*", and per the codebase's
  own stated principle of not merging near-duplicates without a proven
  repeated-bug need), keyed by numeric writer id instead of category slug.
- `GET /api/writer/[id]/articles` (new BFF route,
  `app/api/writer/[id]/articles/route.ts`) — mirrors
  `app/api/category/[slug]/route.ts` exactly, backed by the new
  `getWriterArticles()` in `lib/writer.ts` (reuses `ItemSchema`/`mapItem`
  from `lib/feed.ts` rather than re-parsing the pagination envelope).
- `lib/writer.ts` — `WriterProfile` gained `articlesCount`/`lastActivityAt`
  (from the Phase-1-fixed `articles_count`/`last_activity_at` fields).
- Page rewritten: full-bleed header, then a `Container` with a
  `grid lg:grid-cols-12` — `main` (8 cols) holds the feed or an empty state
  ("no articles yet"), `aside` (4 cols, `hidden lg:block`) holds
  `ReadingSidebar` + `AdZone("aalan_ala_shmal_alaqsam")` + `SubscribeBox` —
  same three components, same zone id, as the category page's sidebar.

**Live-tested against the local Docker stack** (image rebuilt):

| Check | Result |
|---|---|
| Canonical URL | `200`, `<h1>كتاب صدى الشعب</h1>`, page `<title>` correct |
| Article count | renders `79,757 مقال` — confirms the Phase 1 `withCount` fix flows all the way into the UI, not just the raw API response |
| Feed | 18 items on first load (`PER_PAGE`), "تحميل المزيد" button present (`totalPages` > 1 for this writer) |
| Load-more click (real browser, not just curl) | item count went 18 → 36 after one click — confirms the BFF round-trip and client state append both work |
| Sidebar (desktop, 1280px) | `<aside>` `display:block`, contains both ad zones (`ads_in_side` from `ReadingSidebar` + `aalan_ala_shmal_alaqsam`) and the WhatsApp subscribe copy |
| Sidebar (mobile, 390px) | `<aside>` `display:none` — matches category page's `hidden lg:block` |
| Console | no errors/warnings on load or after load-more |
| `tsc --noEmit`, `eslint`, `next build` | all clean; `/news/writer/[idslug]` still builds `●` (SSG) |

**Not part of this phase (explicitly deferred to Phase 4 per §10 item 7):**
canonical/OG/Twitter metadata via `buildMetadata()`, JSON-LD `Person` +
`BreadcrumbList`. `generateMetadata()` still only returns `title`/`description`,
unchanged from Phase 2.

Ready for Phase 4 (SEO) on your go-ahead.

---

## 14. Pre-Phase-4 verification, requested by user, 2026-07-22

Two concerns raised before approving Phase 4 — both investigated with direct
evidence (raw SQL, multiple writers, live BFF responses), not code-review
alone.

### 14.1 `articles_count: 79,757` for writer id=2 — is it really per-writer?

**Confirmed correct, not a bug — but a genuinely unusual dataset.** Raw SQL
against the live DB (`shaabjo-app-db-1`, bypassing the app entirely):

```sql
SELECT COUNT(DISTINCT author_id), COUNT(*) FROM articles;  -- 1, 79757
SELECT author_id, COUNT(*) FROM articles GROUP BY author_id;  -- only author_id=2 appears
```

**Every single article row in this database has `author_id = 2`.** That
writer ("كتاب صدى الشعب" — literally "Site Writers/Authors", a collective
byline) is a placeholder every migrated article was bulk-assigned to — a
characteristic of this specific dataset from before this feature existed,
unrelated to `ShowPublicWriterAction`'s query.

The query itself was independently confirmed correctly scoped by testing the
**other two** `is_writer=1` accounts in the DB, both of which have zero
articles referencing them:

| Writer | `GET /writers/{id}` `articles_count` | Frontend page |
|---|---|---|
| id=2 "كتاب صدى الشعب" | `79757` | header shows `79,757 مقال`, feed paginates |
| id=5 "مخرج الأخبار" | `0` | header shows `0 مقال`, empty state "لا توجد مقالات لهذا الكاتب بعد", no load-more button |
| id=14 "القلعة نيوز" | `0` | (same empty-state code path, not re-screenshotted — identical to id=5) |

If `withCount('articles')` were buggy (global count instead of correlated
per-user), id=5/14 would also show 79,757. They show 0. This is conclusive:
the count is correct; the data just happens to have one writer owning
everything.

### 14.2 BFF route review (`GET /api/writer/[id]/articles`)

| Concern | Finding |
|---|---|
| Breaks caching? | No — identical `fetch(..., { next: { revalidate: 36000, tags } } )` pattern as `getCategoryPage`. The Route Handler itself is correctly dynamic (reads `searchParams` per request, as it must for pagination), but the underlying backend fetch is still Data-Cache-eligible, same as category. |
| Double-fetches page 1? | No — `page.tsx` fetches page 1 once, server-side, for the initial SSR render. `WriterArticlesFeed`'s `loadMore()` only ever requests `page + 1` onward; the BFF is never called with `page=1`. |
| Same order as category page? | **Fixed to be explicit, not just accidentally equal.** `ListPublicArticlesAction` has `defaultSort('-published_at')`, so omitting `sort` already produced the right order (verified: writer/2/articles page 1/2 and the generic `/articles?sort=-published_at` returned identical ids in identical order) — but relying on an implicit shared default was fragile (category and writer pages could silently diverge if that default ever changed for unrelated reasons). Added an explicit `sort: '-published_at'` to `getWriterArticles()`, matching `getCategoryPage`'s own explicit choice. Re-verified after the change: still strictly descending by `publishedAt` across pages, no gaps, no reordering. |
| Same schema as `NewsListItem` expects? | Yes, structurally guaranteed, not just shape-matching by coincidence — `getWriterArticles()` reuses `ItemSchema` and `mapItem()` **imported directly from `lib/feed.ts`**, the same functions `getCategoryPage` uses. Both produce `FeedItem[]`, the exact type `NewsListItem` consumes. |

Ready for Phase 4 (SEO) on your go-ahead.
