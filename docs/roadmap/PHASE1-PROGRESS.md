# Phase 1 — Foundation Consolidation & Event Spine

Running execution log for AlphaCMS 2036 Roadmap, Phase 1. One section per
completed task, in commit order. This is the official reference for
Phase 1 — do not treat any task as done without an entry here.

Phase 1 definition of done (from the roadmap): all six content types emit
real domain events; zero API/route/schema breakage; first entity-tagged
content exists.

---

## Task 4 — Canonical Entity registry (manual tagging)

**Commit:** `9546972da` — Add canonical Entity registry for manual content
tagging (Phase 1)

### What was implemented
- `entities` table: canonical, disambiguated records of type
  `person|organization|place|topic` (`App\Enums\EntityType`), with a
  slug unique per type, optional description, and a reserved
  (unused) `external_ref` column.
- `content_entity` pivot table: polymorphic link from any content type
  to an `Entity`, with reserved (unused) `assigned_by_type/id`,
  `status`, and `confidence` columns for later phases.
- `Article::entities()` — the first (reference) `morphToMany` wiring,
  manual attach/detach only.
- `App\Models\Entity` — audited via `AuditsChanges` per the model-audit
  convention (`auditLogName='entity'`).

### Why
- ADR-E5 (`docs/adr/E5-entity-registry-not-tags.md`): entity tagging is
  the one Phase 1 item that is genuinely one-way — content published
  without a canonical entity link cannot be re-linked with full accuracy
  later. Cheapest to start now, before archive volume grows further.
- Deliberately **not** built on the existing `Spatie\Tags` system
  already used by `Article` (`HasTags`): tags solve free-text
  folksonomy, not canonical disambiguated identity. Conflating the two
  was rejected as a modeling mistake (see ADR-E5 for the full
  alternatives-rejected list).
- Manual tagging only — AI-assisted tagging (Phase 5) and Knowledge
  Graph linkage (Phase 4) are out of dependency order this early; the
  schema reserves the columns they'll need so no later migration is
  required, only activation.

### Database changes
- **New tables (2):** `entities`, `content_entity`.
- **New indexes:** `entities`: `type`, `unique(type,slug)`,
  `entities_type_name_idx(type,name)`,
  `entities_deleted_type_idx(deleted_at,type)`. `content_entity`:
  `content_entity_unique(entity_id,taggable_type,taggable_id)`,
  `content_entity_taggable_idx(taggable_type,taggable_id)`, plus the
  automatic FK index on `entity_id`.
- **New FKs:** `entities.created_by_id → users.id` (nullOnDelete);
  `content_entity.entity_id → entities.id` (cascadeOnDelete).
  `taggable_type/taggable_id` has no DB-level FK (standard Laravel
  polymorphic limitation).
- **Existing tables/columns modified:** none.
- **Migration class:** pure `CREATE TABLE` on new, empty tables —
  online-safe, no lock on `articles`, no downtime.

### Public contracts affected
**None — verified, not assumed.** `ArticleResource` was read directly:
it is a strict explicit whitelist (`whenLoaded()`-guarded), contains no
`entities` key, and cannot change shape without a deliberate future
edit. Grep confirmed zero existing call sites reference `->entities()`
anywhere in `app/` outside this task's own files. Scout
(`toSearchableArray`/`searchableAs`/`makeAllSearchableUsing`), cache
tags (`ArticleCacheTags`), routes, and pagination are all byte-identical
to before. Full audit in the Task 4 validation report (this
conversation) covers Article/Category/Search/Admin APIs, SEO, URLs,
Resources, JSON structure, pagination, and cache tags individually.

### Test evidence
- New: `tests/Feature/Admin/Content/EntityTaggingTest.php` — 7/7
  passing (creation + audit-log assertion, cross-type slug
  non-collision, same-type slug uniquification, multi-entity tagging,
  duplicate-tag rejection via unique constraint, independence from
  `Spatie\Tags`, soft-delete behavior of the relation).
- Regression: `--filter="Article"` baseline (clean `main`,
  `5b141d3c4`) vs. post-change, measured twice:
  - Baseline: 217 tests, 208 passed, 9 failed, 716 assertions, 344.1s.
  - Post-change: 219 tests, 210 passed, **9 failed (identical set)**,
    719 assertions, 347.3s.
  - Delta fully reconciled: +2 tests / +3 assertions = exactly the new
    Entity tests whose descriptions match the "Article" filter
    substring. **Zero new failures, zero fixed, zero changed** — all 9
    failures proven pre-existing on unmodified `main` (see Known Issues
    below).

### Rollback procedure
1. `php artisan migrate:rollback --step=2` (drops `content_entity`,
   then `entities`, correct batch order, no manual intervention).
2. `git revert 9546972da`.
- No data loss for any pre-existing data. Any rows written into the two
  new tables during a live window would be lost on rollback — currently
  a non-issue since no consumer wires `->entities()` into any Action or
  UI yet (ships inert; Task 12 is the first real consumer).
- Old (pre-Task-4) code runs unaffected against the new schema in
  either rollback direction (code-only or schema-only).

### Known issues discovered (tracked separately, not Phase 1 scope)
- 3 pre-existing failures in `ArticleEditorContractTest` (content
  sanitizer accepting `javascript:` hrefs / non-allow-listed embeds /
  invalid text-alignment — expects 422, gets 201) — flagged as a
  possible security-relevant gap, spun off as `task_a9fe3b88`.
- 6 other pre-existing failures share one root cause: `canonicalPath()`
  emits `/article/{id}` while 4 test files expect
  `/articles/{id}-{slug}`. Tracked as separate technical debt, not
  mixed into the Phase 1 roadmap per explicit instruction.

---

## Task 5 — Domain event: wrap TransitionArticleStatusAction side-effects

**Commit:** `8094bea02` — Wrap article status transition side-effects in a
domain event

### What was implemented
- `App\Events\Content\ArticleStatusChanged` — the platform's first real
  domain event, dispatched once after a committed status transition.
- Three listeners in `App\Support\Content\Listeners` (deliberately **not**
  `app/Listeners` — see below): `InvalidateArticleCacheOnStatusChanged`,
  `PurgeArticleCdnOnStatusChanged`, `NotifyWriterOnArticleStatusChanged`,
  registered explicitly (and in that order) in
  `AppServiceProvider::configureContentEvents()`.
- `TransitionArticleStatusAction` now dispatches the event where it used
  to call the three side-effects inline; nothing else in the action
  changed.

### Why
- ADR-E2 (`docs/adr/E2-domain-events-wrap-not-replace.md`): the one real
  architectural gap in this slice of the system — side-effects written
  imperatively inside one Action, instead of an event spine new
  consumers (AI, read models, analytics) can attach to without touching
  the publish path itself.
- Wrap, not replace: every line moved verbatim into its listener — same
  behavior, same order, same synchronicity. Listeners are deliberately
  **not** queued — that would change observable response timing (a
  separate, not-yet-made architectural decision), not something to slip
  in here.

### Database changes
None — pure application-layer refactor.

### Public contracts affected
**None.** Same HTTP response shape, same cache tags, same CDN purge
call, same notification call, same listener execution order (verified
via `php artisan event:list`). Timing/synchronicity explicitly
preserved — the response still waits for all three side-effects exactly
as before.

### Test evidence
- New: `tests/Feature/Admin/Content/ArticleStatusEventTest.php` — 5/5
  passing (event dispatched exactly once with correct payload; not
  dispatched when the workflow guard denies before the transaction
  starts; cache tag still flushed, CDN batch still queued, writer still
  notified — all via the real, non-faked listener chain).
- **Bug caught by this task's own test, fixed before proceeding:**
  first run showed the writer notified **twice**. `event:list` proved
  each listener was registered twice — Laravel 11 auto-discovers
  `app/Listeners`, and I'd also registered them explicitly, causing
  double execution. Fixed by relocating listeners to
  `App\Support\Content\Listeners`, mirroring the existing
  `App\Modules\Notifications\Listeners` convention (which avoids this
  exact trap for the same reason). Re-verified via `event:list` (each
  listener now appears once) and the test suite (5/5 green).
- Regression (`--filter="Article"`): baseline 217/208 passed/9 failed →
  post-change 224/215 passed/**9 failed (identical set)**. Delta (+7
  tests/+12 assertions) fully reconciled to the 5 new tests (whose
  filename itself matches the filter) — **zero new failures, zero
  fixed, zero changed** among the pre-existing 9.
- A 10th failure surfaced outside the "Article" filter's scope
  (`WriterNotificationTest::returns_403_for_a_non_writer_user`). Proven
  pre-existing via an explicit stash-and-rerun against the clean
  Task-4-only state (failed identically with zero Task 5 changes
  present) — unrelated, spun off as `task_47f36988`, not mixed into
  this roadmap.

### Rollback procedure
1. `git revert 8094bea02` — single commit, no migration to unwind, no
   data implications (zero tables touched).
2. Old/new code distinction doesn't apply here — no schema changed in
   either direction.

### Known issues discovered (tracked separately, not Phase 1 scope)
- Notifications-list endpoint returns 200 instead of 403 for
  non-writers — pre-existing, proven unrelated, tracked as
  `task_47f36988`.

---

## Task 6 — Editorial workflow: shared engine + event-wrapping for Video/Reel

**Roadmap correction:** the original wording ("extend workflow
guard+transition pattern to Video/Reel/Broadcast") was wrong on
inspection. `VideoWorkflowGuard` and `ReelWorkflowGuard` already existed,
independently evolved, not copied from Article. Broadcast has no
transition-matrix workflow at all (verb-specific lifecycle actions:
`StartBroadcastAction`, `EndBroadcastAction`, `FailBroadcastAction`,
etc.) — confirmed via `app/Actions/Admin/Broadcast/` (27 actions), not
assumed, and excluded from this task entirely.

### Design review (performed before any extraction — see conversation
for full 6-question review)
Read all three guards + both existing transition actions side by side.
Findings: `TRANSITIONS`/`WRITER_ALLOWED` and the guard algorithm shape
are byte-identical across Article/Video/Reel; `isEditorial()` is also
byte-identical in all three `*AuthorizationGuard` classes. Real,
preserved divergences: Video/Reel gate certain transitions behind an
extra permission (`videos.publish/archive`, `reels.publish/archive`)
that Article's guard lacks; Video has no revision recording
(`VideoRevisionRecorder` doesn't exist — confirmed via grep); Video has
no dedicated CDN-purge class (Article/Reel do). Chosen architecture:
one generic, model-agnostic `EditorialWorkflowGuard` engine consuming a
per-type `WorkflowDefinition` (pure data) — composition, not
inheritance — with the divergences expressed as data (an empty
`abilityForTarget` map for Article) rather than branches.

### Task 6a — shared engine + guard migration (4 commits)
- `a94ac6a82` — `WorkflowDefinition` + `EditorialWorkflowGuard` +
  `ApplyEditorialTransition`, new and isolated, 11 unit-level tests
  against fabricated definitions before any real guard touched it.
- `7d6c137c1` — `ArticleWorkflowGuard` migrated (thin wrapper, signature
  unchanged, `abilityForTarget: []`). Regression: 225/216 passed
  (`--filter="Article"`), same 9 pre-existing failures, zero
  new/fixed/changed.
- `a09deb83c` — `VideoWorkflowGuard` migrated (ability map: publish→
  `videos.publish` for both published and scheduled, archive→
  `videos.archive`). Regression: 89/88 passed (all VideoLibrary tests +
  WriterNotificationTest), same 1 pre-existing failure only.
- `a5cf40cff` — `ReelWorkflowGuard` migrated (ability map: publish/
  archive only — Reel does **not** gate scheduling behind an ability,
  unlike Video; preserved as a real difference, not unified).
  Regression: 105/104 passed, same 1 pre-existing failure only.

### Task 6b — event-wrapping Video/Reel (1 commit, `f5606fe2e`)
`VideoStatusChanged` / `ReelStatusChanged`, mirroring
`ArticleStatusChanged` exactly — separate small event classes per type
(not one generic discriminated event, per the design review). Listeners
placed under `App\Support\Content\Listeners` from the start (learned
from Task 5 — verified via `event:list` that each registers exactly
once before trusting any test). Every listener moves an existing
imperative call verbatim; Video's still-missing CDN-purge class and
still-missing revision recording are untouched, not silently "fixed" as
a side effect. Regression: Video 93/92 passed (+4 new tests), Reel
89/89 passed (+4 new tests), zero new/fixed/changed.

### Database changes
None across all of Task 6 — pure application-layer refactor.

### Public contracts affected
None. Every `*WorkflowGuard::check()` public signature is byte-identical
to before; every Action's HTTP contract, cache tags, CDN behavior, and
notification behavior is unchanged — only the internal implementation
moved from copy-pasted logic to shared engine + data, and from
imperative calls to event dispatch.

### Rollback procedure
Six independent commits (`a94ac6a82` through `f5606fe2e`), each already
proven not to break anything on its own — revert from the end backward
as far as needed; no migration to unwind at any point, no data
implications (zero tables touched in Task 6).

### Known issues discovered (tracked separately, not Phase 1 scope)
- Video has no revision recording (unlike Article/Reel) — real gap,
  not fixed here, not silently decided either way.
- Video has no dedicated CDN-purge class (unlike Article/Reel) — same
  treatment.
- Error-message translation key naming has already drifted per type
  (`article.schedule_requires_future_date` vs `video.schedule_requires_date`
  vs `reel.schedule_future` for the same rule) — preserved exactly as-is
  per type in each `WorkflowDefinition.messages` map; not unified, to
  avoid an unrequested user-facing string change.

---

## Task 7 — Shared cache-tag scheme (Article/Reel/Video/Page/Broadcast)

**Roadmap correction (smaller than expected):** the original wording
("kill the 7-near-duplicate cache-tag-class pattern") assumed uniform
duplication. Reading all five side by side (`AdCacheTags`/
`TeamMemberCacheTags` excluded — confirmed genuinely different concerns,
zone/campaign and roster tagging, not feed/detail/category content)
showed the identical part is only the key-string format; the
substantive logic (`invalidationTags`) has real per-type variation:
category cardinality (Article: many, Video/Broadcast: one, Reel/Page:
none), sitemap presence, and — the one true outlier — Broadcast omits
its partition dimension (`kind`) from `detail()`/`category()` keys
entirely, unlike the other four.

### Design
`CacheTagScheme` (readonly DTO + methods) captures this as data:
`sitemap: ?string`, `detailDimensioned`/`categoryDimensioned: bool`,
category slugs always passed as an array (0, 1, or many elements
uniformly — no separate single/multi code path). Hand-verified against
each of the five classes' actual current output before touching any of
them (10 tests in `CacheTagSchemeTest.php`), including reproducing
Broadcast's non-dimensioned keys exactly.

### Commits (6, each independently verified)
- `6941f0050` — `CacheTagScheme`, new and isolated, 10 tests replaying
  each type's documented behavior by hand.
- `6fe40715d` — `ArticleCacheTags` migrated. Regression: 55/53 passed,
  same 2 pre-existing failures only.
- `5efb05b25` — `ReelCacheTags` migrated (no sitemap, no category).
  Regression: 89/89 passed.
- `098063a61` — `VideoCacheTags` migrated; `playlist()` family left
  untouched as a genuinely Video-only concept, not forced into the
  scheme. Regression: 93/92 passed, same 1 pre-existing failure only.
- `8c3d4e4da` — `PageCacheTags` migrated (same shape as Reel).
  Regression: 20/20 passed.
- `7630c4535` — `BroadcastCacheTags` migrated — the critical case
  (non-dimensioned keys), verified against the full 140-test Broadcast
  suite rather than a subset. Regression: 140/140 passed.

Zero new/fixed/changed failures across all six commits.

### Database changes
None — pure application-layer refactor.

### Public contracts affected
None. Every `*CacheTags` public method signature is byte-identical to
before (verified per-commit against each type's real test suite, not
assumed from the shared design alone).

### Rollback procedure
Six independent commits (`6941f0050` through `7630c4535`); revert from
the end backward as far as needed. No migration to unwind, no data
implications at any point.

### Known issues discovered (tracked separately, not Phase 1 scope)
None new — this task's investigation confirmed prior findings
(Reel/Page's independent scope, no fresh gaps).

---

## Task 8 — MediaAsset rights/license metadata

**Commit:** `d6c9c0ee9`

### Pre-task review
Confirmed `credit`/`source` already exist (added in
`2026_05_20_110000_extend_media_assets_for_editorial_library.php`, read
in full to match its exact style); `license_type`/`rights_expiry_at`/
`usage_terms` genuinely absent. No architectural ambiguity found — the
one judgment call (formal enum vs. plain string for `license_type`) is
recorded below, not silently decided.

### What changed
Three nullable columns on `media_assets`: `license_type` (string),
`rights_expiry_at` (timestamp), `usage_terms` (text). Added to
`MediaAsset`'s `$fillable` and `AuditsChanges` `$auditAttributes`
whitelist.

### Why
Real, present-day legal/compliance exposure (using media past a rights
expiry or without required attribution), independent of scale — see the
product-philosophy review earlier in this project's history.

### What stayed the same
Everything else. `license_type` is a **plain nullable string, not a
formal PHP enum** — deliberately, since no admin UI consumes it yet and
no taxonomy has been requested; committing to a specific closed set of
values now would be inventing business rules nobody asked for. Upgrading
to an enum later (once a real UI need defines the taxonomy) is a
non-breaking, additive change to the cast layer only.

### Regression / backward compatibility
68/68 passed across all Media tests (65 baseline + 3 new). Grep-confirmed
zero existing `Http\Resources` reference the new fields — no API
response shape changes anywhere.

### Performance impact
None measurable — three new nullable columns on an existing table, no
new queries, no new indexes needed (not queried/filtered by yet).

### Risks
None identified. Purely additive, all-null default state.

### Architecturally better, or just cleaner?
Neither, strictly — this task adds new *capability* (data the system
didn't capture before), not a refactor of existing structure. It doesn't
change the system's architecture; it closes a real gap flagged in the
Product Evolution review.

---

## Task 9 — Reserve nullable `tenant_id` on core content tables

**Commit:** `82e9565ed`

### Pre-task review (scope correction)
The roadmap's wording assumed one `categories` table. Verified via
migration search: there are **three** (`categories`, `video_categories`,
`broadcast_categories`), plus `pages`, `video_playlists`, and Task 4's
`entities` — all genuinely core-content tables. Expanded scope to all 11
for consistency rather than reserving the column on an arbitrary subset.

### What changed
`tenant_id` (nullable `unsignedBigInteger`, no FK — no `tenants` table
exists) added to: articles, videos, reels, broadcasts, pages, categories,
video_categories, broadcast_categories, video_playlists, media_assets,
entities.

### Why
Cheap now (tables far from 2M+ rows on most of them), expensive later
(`ALTER TABLE` on a live multi-million-row table). Matches
[ADR-005](../adr/005-tenant-locale-first-class.md) (tenant identity is a
first-class, Must-Decide-Now concern) — but only the column, nothing else.

### What stayed the same
Everything. Zero application code reads or writes this column — no
`$fillable` addition, no cast, no query scope. **No index added** —
deliberately: the correct composite index shape depends on real
tenant-scoped query patterns that won't exist until Phase 6 activates
this (gated on a real second white-label client, not a calendar date,
per the architecture review). Guessing an index shape now would be
speculative.

### Regression / backward compatibility
Cross-section covering every affected table type (Article, Category,
Page, Video playlists, Broadcast, MediaAsset, Entity): 99/99 passed.
Fully additive; no existing code path touches the new column.

### Performance impact
None measurable *at query time*. One extra nullable column per row on
11 tables — no new queries, no new indexes, no write-path changes.

**Correction (found during Task 14's production-readiness audit, not
assumed at the time): the migration's own cost on `articles` was
understated.** "Cheap now (tables far from 2M+ rows on most of them)"
was true for 10 of the 11 tables but not for `articles` — 217,460 rows,
and empirically confirmed via `EXPLAIN`-equivalent testing (forcing
each `ALGORITHM=` in turn) that MySQL 8.4 **rejects both `INSTANT` and
`INPLACE`** for `ADD COLUMN ... AFTER id` on this specific table,
because `articles` carries a `FULLTEXT` index (on `title`) and InnoDB's
instant/in-place DDL paths don't support tables with FULLTEXT indexes
for this operation — only `ALGORITHM=COPY` (full table rebuild) is
accepted. Measured directly against the real local dataset: **177
seconds** for the rebuild. A `COPY` rebuild holds a lock that blocks
writes to `articles` for its full duration. None of the other 10 tables
have a FULLTEXT index, so they were genuinely cheap as described.

This does not change the decision (ADR-005 and this task's column
reservation are still correct) — it changes the deployment
*procedure*: applying this migration to a production database should
be scheduled during a low-traffic window with the ~3-minute
`articles`-write-blackout communicated in advance, not run as an
unattended step in a routine deploy pipeline. See
[PHASE1-PRODUCTION-READINESS.md](PHASE1-PRODUCTION-READINESS.md) for
the full methodology.

### Risks
The single real risk this task defers rather than resolves: **when**
Phase 6 activates tenancy, retrofitting *enforcement* (scoping every
query, every cache key, every search index by tenant) is a substantial
undertaking regardless of whether the column exists — this task only
removes the schema-migration part of that future cost, not the
application-logic part.

### Architecturally better, or just cleaner?
Neither yet — this is pure optionality banking. It becomes
architecturally significant only when Phase 6 activates it.

---

## Task 10 — Add Reel and Broadcast to the Scout searchable set

**Commit:** `871dfe12a`

### Pre-task review
Confirmed via grep: zero prior references to `reels_index`/
`broadcasts_index` anywhere — fully greenfield, no conflicting
assumption to correct. Read `Video`'s existing Scout implementation
(the most complete precedent) and `ResilientSearchable` in full before
writing anything, to mirror the fail-safe pattern exactly rather than
inventing a new one.

### What changed
`Reel` and `Broadcast` now use `ResilientSearchable`, with
`searchableAs()`/`shouldBeSearchable()`/`toSearchableArray()` +
matching `reels_index`/`broadcasts_index` Meilisearch settings in
`config/scout.php`.

### Why
Two of six content types had no search coverage at all — a real,
present gap, not a duplication-driven refactor like Tasks 6/7.

### What stayed the same
Everything about Article/Video/Page/Epaper's existing search behavior.
Neither `Reel` nor `Broadcast` needed a `makeAllSearchableUsing()`
override (unlike `Article`) — their searchable arrays only embed IDs and
enum values, not related entity names, so there's no N+1 to guard
against.

### Design decisions requiring judgment (recorded, not silently made)
- **Reel** is searchable under the same condition as `scopePublished()`
  (published + past `published_at`) — a direct mirror of existing
  business logic, not a new rule.
- **Broadcast** is searchable only when `status` is `Live` or `Ended`
  **and** `is_public` is true. Draft/Scheduled/Offline/Failed/Archived
  are excluded. This is the one real judgment call: whether *Archived*
  broadcasts should remain searchable as historical VOD wasn't
  specified anywhere, so I did not guess — excluded for now, flagged
  here for a product decision if archived-broadcast search is wanted
  later (additive change, not a breaking one).
- **Broadcast's index uses `kind` (live/tv/radio), not `locale`** —
  consistent with Task 7's finding that Broadcast isn't locale-
  partitioned in this system at all.

### Regression / backward compatibility
Reel: 93/93 passed (89 baseline + 4 new). Broadcast: 144/144 passed (140
baseline + 4 new). Zero new/fixed/changed among prior tests in either
suite.

### Performance impact
New write-path cost: each Reel/Broadcast save now triggers a Scout sync
(same mechanism already paid by Article/Video/Page, wrapped in the same
fail-safe trait — a transport failure logs a warning, never fails the
save). No new read-path cost until something actually queries these new
indexes (nothing does yet — that's future admin/public search UI work,
out of this task's scope).

### Risks
None identified for existing behavior. The one open question (archived
broadcasts in search) is a product decision, not a technical risk.

### Architecturally better, or just cleaner?
Neither — this is new capability (closing a real search-coverage gap),
consistent with the pattern already established for Article/Video, not
a structural change.

---

## Task 11 — Wire `CLIENT` env into the Next.js frontend

**Status: closed, no code change.** The roadmap's premise was wrong.

### Pre-task review (assumption rejected)
Original framing: `CLIENT` in `docker-compose.yml`
(`alphacms-frontend:${CLIENT}`) is unread by any frontend code, so
branding is "misleading" for white-label deployments. Traced the actual
branding data flow before touching anything
(`frontend/src/lib/site-settings.ts`): site name, logos, social links,
navigation — **all** of it is fetched fresh per request from the
backend's `/api/v1/site` endpoint. Nothing is hardcoded in the frontend
build.

Combined with the confirmed deployment-per-tenant architecture (each
white-label client gets its own full backend + database + Settings),
this means branding is **already correct per deployment** — not because
of `CLIENT`, but because pointing a frontend build at a different
backend's `API_BASE_URL` automatically serves that backend's branding.
`CLIENT` only ever did one thing: tag the Docker image for
registry/build bookkeeping — which already works today without any
application code reading it.

**Presented this finding to the user rather than implementing a fix for
a bug that doesn't exist** (per the standing rule: stop and review when
the roadmap's assumption doesn't hold). Decision: close with no action.

### What changed
Nothing in code. This entry exists so a future contributor doesn't
re-investigate this and reach a different conclusion — `CLIENT`
remaining unread by application code is correct, not a gap.

### Risks
None. If per-client *behavioral* differences (not branding) are ever
needed, the existing backend-Settings pattern (e.g. `newspaper_enabled`)
is the established, correct place for that — not a frontend build-time
flag.

---

## Task 12 — Admin UI: entity tagging widget on content edit screens

**Commits:** `01db2e329` + `81074b083` (backend), `b2dd6aa8f` (Article
widget), `05a9cae66` (Video/Reel widget + i18n generalization)

### Pre-task review
Task 4 shipped the `entities`/`content_entity` schema and `Article`'s
`entities()` relation inert — this task is its first real consumer.
Confirmed via grep: zero existing UI or API surface for entities before
this task; fully greenfield, no conflicting assumption to correct on
the backend side.

### What was implemented
**Backend (12a):** generic Actions accepting a `Article|Video|Reel`
union (`ListEntitiesAction`, `CreateEntityAction`,
`SyncContentEntitiesAction`) — one implementation, not three near-
duplicates, since the sync/list logic has zero real per-type variation
(unlike Task 7's cache tags, where variation was real). `EntityController`
exposes search/create (`GET/POST /admin/entities`) and per-type
read/sync (`GET/PATCH /admin/{articles,videos,reels}/{id}/entities`).
`Video`/`Reel` gained the same `entities()` MorphToMany relation
Article already had. New `entities` permission group (view/create/edit/
delete), added to both the main permissions array and the separate
group-metadata map in `RolesAndPermissionsSeeder`.

**Frontend (12b + 12c):** `entities.service.ts` + four hooks
(`useEntitySuggestions`, `useCreateEntity`, `useContentEntities`,
`useSyncContentEntities`) + one self-contained widget
(`EntityTagsInput`, parametrized by `contentType`/`contentId`) — chip
input with typeahead, inline "create as person/organization/place/
topic", disabled with a "save first" message until the content has an
id. Wired into `ArticleFormPage`, `VideoFormPage`, and `ReelFormPage`.

### Why
Entity tagging is the roadmap's own definition-of-done item ("first
entity-tagged content exists") — until an admin can actually attach an
entity, Task 4's schema is unreachable. Generic Actions (not three
per-type classes) because, unlike Task 7, there was no real logic
variation to preserve — only the content-type string threading through
to pick a URL/relation, which a discriminated parameter handles more
simply than three classes would.

### What stayed the same
Everything about existing Article/Video/Reel read/write paths, `Spatie\Tags`
(unaffected — entities are additive, not a replacement), and every
other admin screen. `TagsInput` (free-text tags) stays Article-only
with its own `articles.form.tags.*` keys, unchanged — it has exactly
one consumer, so nothing about it needed generalizing.

### Design decision surfaced mid-task, not silently made
Task 12 was originally delivered for Article only (12b), even though
the backend (12a) already supported all three content types end-to-end.
Extending to Video/Reel wasn't purely mechanical: `EntityTagsInput`'s
translation strings were hardcoded under `articles.form.entities.*` —
fine with one consumer, wrong to reuse verbatim once Video/Reel became
real second and third consumers. Presented this fork to the user rather than
either silently leaving Video/Reel unwired or silently renaming keys;
approved option was to relocate the keys to a shared top-level
`entities.*` namespace in `content.json` (same Arabic/English strings,
zero visible change) and finish wiring all three screens in this task
(12c), rather than opening a separate follow-up for something that was
already the original scope.

### Regression / backward compatibility
Backend: `EntityManagementTest.php` 15/15 (search, type filter, create,
duplicate-name rejection, cross-type name reuse, permission denial,
sync onto article/video/reel, entity removal via re-sync, invalid-id
rejection, read current entities, empty state, permission denial on
read) — re-run clean both immediately after 12a and again after 12c's
unrelated frontend-only changes. Frontend: `tsc --noEmit` and
`vite build` clean after both 12b and 12c. Zero existing i18n key
consumers broken by the relocation — grep-confirmed `TagsInput.tsx`
(the only other widget near the old key path) reads its own
`articles.form.tags.*` keys, untouched.

### Live verification (not just automated tests)
Full interactive click-through against real local data: logged in,
opened a real article (990030), typed a search query, confirmed the
typeahead and "create as [type]" buttons render with correct labels,
created a new "place" entity, confirmed it attached as a chip, and
confirmed it survived a full page reload (proving server persistence,
not just client cache). Repeated the read-path check on a real Video
(id 1) and Reel (id 1) after 12c — both load their current entities
(200 OK) and render the section correctly; the create+sync write path
was not re-exercised interactively for Video/Reel since it is the
identical, already-proven frontend code path calling a backend already
covered by the passing "syncs entities onto a video/reel" tests.

**Bug caught during live verification, fixed as an operational step
(not a code change):** entity creation initially returned 403 Forbidden
against the local dev database, even though the seeded test user held
`super_admin`. Root cause: the `entities.*` permissions were added to
`RolesAndPermissionsSeeder`'s source in 12a, but seeder *file* changes
don't retroactively apply to an already-seeded database — the local dev
DB had been seeded before that change. Fixed by granting the four
`entities.*` permissions to `super_admin` directly against the local
database (mirroring exactly what the seeder now does for any fresh
environment). Not a code defect; flagged here because the same trap
will recur for any other environment seeded before this commit.

### Performance impact
New write-path cost on Article/Video/Reel save is unaffected — entity
sync is a separate, explicit PATCH the widget fires only on actual
chip add/remove, not on the main content-form save. New read-path
cost: one extra `GET .../entities` per content-edit page load (disabled
until the content has an id) plus typeahead queries while the input is
focused with text — both hit a table with zero rows today, effectively
free; will need a query-plan check once entity volume grows, not before.

### Risks
None identified for existing behavior. The temporary local-dev-only
state created during verification (a throwaway `preview-test@example.com`
super_admin user, momentarily disabled reCAPTCHA) was fully reverted
before this task closed — no residual state in the local database
beyond the four newly-granted `entities.*` permissions on `super_admin`,
which is exactly what a fresh seed run would also produce.

### Architecturally better, or just cleaner?
Better: this is the first schema-to-UI slice built as one generic,
content-type-parametrized path (Action → Controller → service → hooks
→ widget) rather than per-type duplication, and it's proven against a
real second and third consumer (Video/Reel) in the same task, not
speculatively generalized ahead of need.

---

## Task 13 — Write ADR docs for Phase 1 decisions

**Commits:** `715d934fd` (foundational ADR-001–016 + architecture
reference), `1cc864da8` (Phase 1 execution ADRs E1, E6)

### Pre-task review (assumption corrected, scope expanded)
Before writing anything, checked what already existed:
`docs/adr/{E2,E5,E7}-*.md`. Grepping the whole repo for `ADR-` surfaced
two problems the task's literal title didn't anticipate:
1. `ADR-E1` is cited twice in already-shipped code (a `content_entity`
   migration comment and inside `E5-entity-registry-not-tags.md` itself)
   as the reason content stays in separate per-type tables during
   Phase 1 — but the file never existed.
2. This entry's own Task 9 section cites "the architecture review's
   ADR-005" as a checkable decision. It wasn't checkable — no file
   under `docs/` contained it. The full content existed only in this
   session's raw conversation history: a complete, previously-approved
   16-item "AlphaCMS Target Architecture" document (ADR-001–016 —
   `ContentItem` core model, CQRS-lite, cross-context event spine,
   tenant+locale as first-class identity, edge distribution, AI as a
   layer, bounded contexts, deployment/evolution roadmap) that was
   never persisted anywhere.

Surfaced both findings to the user before proceeding rather than
guessing at scope — asked specifically whether persisting the
foundational ADR-001–016 set belonged in this task (since it predates
and spans all phases, not just Phase 1) or a separate one. Decision:
include it here, since the content required zero new decision-making
(already approved verbatim) and directly resolves the dangling
`ADR-005` citation.

### What was implemented
- `docs/architecture/TARGET-ARCHITECTURE.md` — full reference doc,
  faithfully transcribed from the approved architecture (principles,
  bounded contexts, core domain model, read/event/AI/deployment
  architecture, evolution roadmap), with two clearly-marked editorial
  notes (not part of the original approved text) cross-linking to
  Phase 1's place within it.
- `docs/adr/001-*.md` through `016-*.md` — the 16 foundational
  decisions as individual records, each a faithful transcription (not
  new authoring) of the already-approved reason/rejected-alternatives/
  impact for that decision, with a backlink to the full reference doc.
- `docs/adr/E1-defer-content-item-unification.md` — the confirmed
  missing Phase-1-execution decision: written fresh (not transcribed)
  from the actual citing context, in the fuller 6-section template
  E2/E5/E7 already established (القرار/لماذا/البدائل المرفوضة/ماذا
  سنندم عليه؟/قابل للتراجع؟/التكلفة).
- `docs/adr/E6-workflow-guard-data-driven-engine.md` — Task 6's shared
  `EditorialWorkflowGuard`/`WorkflowDefinition` engine, written fresh in
  the same template. Judged this the one Phase-1 decision beyond E1
  that clearly clears the same bar E2/E5/E7 set (a real, analyzed
  architectural fork with rejected alternatives) but never got a
  record — it's the same "data-driven scheme, not a forced interface"
  pattern as E7, just applied to workflow guards instead of cache tags.
- Fixed the dangling citation this task started from: Task 9's "the
  architecture review's ADR-005" is now a working link to
  `docs/adr/005-tenant-locale-first-class.md`.

### Why
An ADR that's cited but not retrievable is worse than no citation at
all — it tells the next reader a decision record exists somewhere,
sends them looking, and wastes their time. This was true twice over
(`ADR-E1`, `ADR-005`) before this task.

### What stayed the same
`E2-domain-events-wrap-not-replace.md`, `E5-entity-registry-not-tags.md`,
and `E7-cache-tag-scheme-data-driven.md` — byte-identical, confirmed via
`git diff` against the commit before this task touched anything.
Nothing about any Task 1–12 decision was re-litigated or changed; this
task only documents decisions already made.

### Design decision made, not silently: which Phase 1 tasks get an ADR
Reviewed every Phase 1 task against the bar E2/E5/E7 already set (a
real fork with genuinely rejected alternatives, not just an
implementation choice). Task 6 (→ E6) cleared it. Tasks 8 (MediaAsset
fields — self-assessed as additive capability, not architecture), 9
(tenant_id reservation — tactical execution of already-decided ADR-005,
not a new fork of its own), 10 (Scout searchability conditions —
business-rule judgment calls, not architectural pattern choices), and
12 (generic Actions over per-type duplication — real but small,
comparable to an obvious code-review comment rather than a deep,
regret-worthy fork) did not. This is a judgment call, stated here
explicitly so it can be corrected if wrong — not asserted as
uncontestable.

### Regression / backward compatibility
Not applicable in the usual sense (no code changed), but verified the
documentation-graph equivalent: `git grep`'d every `ADR-E\d+|ADR-\d{3}`
reference across `*.php` and `*.md` repo-wide (21 distinct references)
and confirmed every single one now resolves to a real file under
`docs/adr/`. Zero dangling references remain.

### Performance impact
None — documentation only.

### Risks
None identified. The one thing worth flagging: the foundational
ADR-001–016 set was transcribed faithfully from what was already
approved, but transcription itself carries a small risk of a copy
error going unnoticed — mitigated by generating each file directly
from the extracted source text rather than re-typing from memory.

### Architecturally better, or just cleaner?
Neither — this task didn't change the system. It made previously
undocumented (or documented-but-unreachable) decisions checkable,
which is a precondition for the comprehensive system review the user
has asked for once Phase 1 completes: that review needs to compare the
system against the target architecture, which required the target
architecture to actually exist as a file first.

---

## Task 14 — Final Phase 1 verification gate: before/after parity, backward compatibility, migration safety, performance, and drift

**Full report:** [`PHASE1-PRODUCTION-READINESS.md`](PHASE1-PRODUCTION-READINESS.md)
(no single commit — this task produced documentation plus one
correction to Task 9's entry above; see that file's own methodology
section for exact commands run).

### What was done
Not another per-task regression run — a from-scratch audit of all 33
Phase 1 commits against an isolated baseline (`5b141d3c4`, checked out
into its own `git worktree` with independent `composer install`/
`npm run build`, not a stash of the working copy). Covered: full Pest
suite before/after (not a filtered subset), every public API route,
every migration's rollback safety (empirically round-tripped against a
disposable database, not just read), live functional checks of cache
invalidation/search resilience/notifications against real Redis/
Meilisearch/database (not test doubles), and a targeted drift hunt
re-checking the exact bug classes Phase 1 had already hit once
(duplicate listeners, permission/metadata mismatches).

### What was found
Two real, evidence-based findings, both non-blocking:
1. Task 9's "cheap now" claim was accurate for 10 of 11 tables but
   wrong for `articles` — a FULLTEXT index forces MySQL 8.4 to reject
   both `INSTANT` and `INPLACE` for the `ADD COLUMN` and fall back to a
   177-second, write-blocking `COPY` rebuild (measured directly, not
   estimated). Corrected in Task 9's entry above; the decision itself
   (ADR-005) doesn't change, only the deployment procedure.
2. A first, apparent 39-vs-14-failure discrepancy between baseline runs
   turned out to be a gap in this task's own methodology (the fresh
   worktree had no built frontend assets, so Vite-dependent view tests
   500'd), not a real difference — traced to a `ViteManifestNotFoundException`,
   fixed by building assets in the worktree, then fully re-verified: the
   failure and error sets are byte-identical between baseline and HEAD.

Everything else — routes, migration reversibility, cache/search/
notification behavior, listener registration, permission/metadata
consistency, translation-key drift, model-audit compliance — came back
clean with zero new issues.

### Why
This is Phase 1's exit gate, not another task's regression check —
the user explicitly asked for no assumptions and for any discovered
regression to be stopped on, investigated, and root-caused before
continuing. Both findings above were run down to a proven cause
(measured MySQL algorithm rejection; a missing build step) rather than
being reported as "probably fine" or "probably a fluke."

### What stayed the same
Every line of Phase 1's actual application code — this task is
read-only verification plus two documentation corrections. No source
file was modified.

### Regression / backward compatibility
The regression check, in full: 1941→2008 tests (+67, matching Phase
1's documented new-test count exactly), identical 14-failure/4-error
sets on both sides, 511→519 routes with zero removed/changed and all 8
additions accounted for. See
[`PHASE1-PRODUCTION-READINESS.md`](PHASE1-PRODUCTION-READINESS.md) for
the full evidence.

### Performance impact
The one real finding is itself a performance finding (§4 of the
production-readiness report) — already covered above. No other
performance regression found.

### Risks
The `articles` migration write-lock (§4) is the only actionable risk,
and only for an environment where that migration hasn't run yet.
Everything else verified clean.

### Architecturally better, or just cleaner?
Neither — this task verified, it didn't change anything. Its value is
confidence: Phase 1 is now provably regression-free against a real
isolated baseline, not just self-reported clean by each task in
sequence.

---
