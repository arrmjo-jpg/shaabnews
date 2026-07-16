# FINAL_BACKEND_REVIEW.md

**Scope:** AlphaCMS backend (Laravel 13.9 / PHP 8.4), reviewed as if
being approved for production deployment tomorrow at real news-site
traffic scale. Every finding below reflects a check actually run in
this session — a command executed, a file read, a code path traced —
not a restatement of an earlier report's conclusion. Where an earlier
session's finding is carried forward, it is labeled as such explicitly,
distinct from what was freshly re-verified here.

**What this review cannot prove, stated honestly up front:** this is a
static/code-level review plus targeted runtime probes against a local
single-node environment. It cannot prove behavior under real concurrent
production load (thousands of simultaneous requests), cannot prove
Redis/MySQL/Meilisearch cluster behavior under failover, cannot audit
third-party dependency CVEs (no `composer audit` run), and cannot audit
infrastructure-level hardening (server config, WAF, network topology) —
none of that is in the backend codebase. Every such gap is called out
in place rather than silently assumed clean.

---

## 1. Architecture

**Finding 1.1 — Target architecture (ADR-001–016) is almost entirely
unbuilt; this is by design, not drift.**
- *Evidence:* No `ContentItem`, no Projection/read-model/ComposedDocument
  concept exists anywhere in `app/` (grep, zero hits). Traced the public
  article-list path end to end: it queries `articles` directly (or
  Meilisearch for search terms) — the same table the admin writes to,
  wrapped in a TTL'd cache, not a maintained event-driven read model.
  Only 2 of the ~12 named bounded contexts (`app/Modules/CDN`,
  `app/Modules/Notifications`) are actually extracted; everything else
  (Content, Media, Advertising, Analytics, Identity, Search, AI) lives
  in the shared `app/Models` (74 files), `app/Http/Controllers` (102
  files), `app/Actions/{Admin,Public,Sport}` structure.
- *Severity:* Informational.
- *Production impact:* None — Phase 1 never claimed to build this, and
  nothing here is broken. Relevant only for Phase 2 planning: assume no
  structural head start beyond the event spine Phase 1 built.
- *Recommendation:* No action needed for deployment. Keep this framing
  explicit in Phase 2 scoping so the gap isn't rediscovered as a surprise.
- *Blocks deployment:* No.

**Finding 1.2 — Where module boundaries exist, they are genuinely
respected, not just nominal.**
- *Evidence:* Zero files under `app/Modules/Notifications/` or
  `app/Modules/CDN/` import any `App\Models\*` class directly (grep,
  zero hits both). Notifications' only external dependency is a neutral
  cross-cutting utility (`App\Support\Responses\ApiResponse`) — it has
  its own Models, Enums, and Support classes.
- *Severity:* Informational (positive finding).
- *Production impact:* Positive — reduces risk when these modules are
  extracted to services later (ADR-014).
- *Recommendation:* Use this as the template when extracting the next
  module.
- *Blocks deployment:* No.

**Finding 1.3 — CORRECTED (was wrong): not dead code, a second live
API surface for the same setting.**
- *Original claim (retracted):* This finding originally claimed
  `app/Actions/Admin/Settings/UpdateCdnSettingsAction.php`,
  `TestCdnConnectionAction.php`,
  `app/Http/Requests/Admin/Settings/UpdateCdnSettingsRequest.php`, and
  `app/Http/Resources/Admin/Settings/CdnSettingsResource.php` were
  dead pre-module-extraction leftovers, based on a `grep` that used
  incorrectly escaped namespace separators and produced a false
  negative — it never actually matched the real single-backslash `use`
  statements in the source.
- *What re-verification found:* `App\Http\Controllers\Api\V1\Admin\Settings\SettingsController`
  imports and actively calls all four: `updateCdn()` uses
  `UpdateCdnSettingsAction` + `UpdateCdnSettingsRequest`, `testCdn()`
  uses `TestCdnConnectionAction`, and `CdnSettingsResource` is used by
  three call sites (`ShowSettingsGroupAction`, `ShowSettingsOverviewAction`,
  and `UpdateCdnSettingsAction` itself). `tests/Feature/Admin/Settings/SettingsWriteTest.php`
  has 20 passing tests exercising `PUT /admin/settings/cdn` and
  `POST /admin/settings/cdn/test` directly — deleting these files
  would have broken a real, tested, currently-passing feature.
- *The real, smaller finding underneath:* the admin-frontend's
  `cdn.service.ts` reads via `GET /admin/settings/cdn` but writes and
  tests exclusively via `Modules\CDN\CdnController` (`PUT /admin/cdn/settings`,
  `POST /admin/cdn/test`) — confirmed by reading the actual frontend
  service file, not assumed. So `SettingsController::updateCdn()` /
  `testCdn()` are live, tested, and reachable, but **not currently
  called by the one known consumer** for writes. This is a real
  two-API-surfaces-for-one-setting situation, not dead code — and
  deciding whether to consolidate them is a product/architecture
  decision, not a delete-the-unused-copy cleanup.
- *Severity:* Low (design duplication, not a functional defect).
- *Production impact:* None currently. Two write paths to the same
  underlying `CdnSettings` singleton is a latent risk if they ever
  diverge in validation or behavior, but they don't today.
- *Recommendation:* Decide deliberately (not unilaterally by an
  audit): either (a) keep both — `/admin/settings/cdn` as the generic
  per-settings-group contract every group follows uniformly, `/admin/cdn/*`
  as the CDN module's richer operational API — and document why, or
  (b) have the frontend's `cdn.service.ts` call the `/admin/settings/cdn`
  write path too and retire the module's `updateSettings`/`test`
  routes, or the reverse. No files were deleted in this pass.
- *Blocks deployment:* No.

---

## 2. Performance

**Finding 2.1 — Public article-list pagination costs ~1.4s on a cache
miss; mitigated but not eliminated.**
- *Evidence:* Measured directly: `php artisan tinker` dispatching a
  real request to `/api/v1/ar/articles?per_page=15` logged a
  `count(*)` query against `articles` (217,460 rows, default
  offset-pagination path) at **1436ms**, versus sub-2ms for every other
  query in the same request. Confirmed this is NOT paid on every
  request: `app/Support/Cache/CachedRead.php` wraps this in a genuine
  single-flight cache (`Cache::lock()`-based, blocking concurrent
  waiters, safe timeout fallback to direct compute, explicit
  cached-null handling) with a 5-minute TTL. An opt-in cursor-pagination
  mode already exists (`?paginate=cursor`) that avoids the COUNT
  entirely, per `app/Actions/Public/Content/ListPublicArticlesAction.php:44,209`.
- *Severity:* Medium.
- *Production impact:* Bounded, not eliminated: one request per unique
  query-shape pays ~1.4s+ every 5 minutes; concurrent requests during
  that window wait on the lock (up to 5s) rather than each independently
  re-running the expensive query. As `articles` grows further, this
  cost only increases, and cursor mode is opt-in, not default, so any
  API consumer that hasn't switched to it still pays this on a miss.
- *Recommendation:* Either flip the default to cursor pagination for
  high-traffic list consumers, or explicitly migrate known consumers
  and deprecate the offset path for this endpoint specifically.
- *Blocks deployment:* No — genuinely mitigated by existing
  infrastructure, but should be tracked, not ignored.

**Finding 2.2 — `articles`' FULLTEXT index forces the expensive `COPY`
ALTER algorithm for any future schema change on that table.**
- *Evidence (carried forward from this session's Task 14, re-cited
  here as it's directly relevant to production risk going forward):*
  MySQL 8.4.3 rejects both `ALGORITHM=INSTANT` and `ALGORITHM=INPLACE`
  for `ADD COLUMN` on `articles` (error 1846, FULLTEXT-index
  limitation), forcing `ALGORITHM=COPY` — measured at 177 seconds,
  write-blocking, on the real dataset. **New in this pass:** confirmed
  via `grep` that a pre-Phase-1 migration
  (`2026_05_19_150000_add_content_json_to_articles_table.php`, dated
  2026-05-19) also used `->change()` on this same table — meaning this
  is a *recurring*, standing constraint on `articles`, not a one-off
  Phase-1 surprise.
- *Severity:* Medium.
- *Production impact:* Any future migration touching `articles`' schema
  will very likely require a multi-minute write-blocking window unless
  explicitly planned around.
- *Recommendation:* Document this explicitly (e.g. a comment at the top
  of any migration touching `articles`, or a note in a CONTRIBUTING/
  migration-guide doc) so the next engineer who alters this table
  schedules it deliberately rather than discovering it live.
- *Blocks deployment:* No — informational for future work, not a defect
  in what exists today.

**Finding 2.3 — RESOLVED: cache coverage confirmed consistent across
all 5 content types.**
- *Evidence:* Grepped every public list/detail Action for
  Article/Video/Reel/Broadcast/Page (8 files) for `CachedRead::remember`
  usage: all 8 use it. Spot-checked Video's and Broadcast's list
  actions directly (not just grep) to confirm they use the same
  stampede-protected `CachedRead` wrapper, not a lesser/naive
  `Cache::remember` without lock protection.
- *Severity:* Informational (positive finding, gap closed).
- *Production impact:* None negative — Task 7's cache-tag scheme and
  the stampede-protection infrastructure benefit all 5 content types
  uniformly, not just Article.
- *Recommendation:* None.
- *Blocks deployment:* No.

---

## 3. Security

**Finding 3.1 — Content sanitizer accepts and silently neutralizes
dangerous input rather than rejecting it; not exploitable, but an
unresolved contract question.**
- *Evidence:* Traced `TipTapSanitizer::clean()`
  (`app/Support/Content/TipTapSanitizer.php`) line by line for all 3
  cases `ArticleEditorContractTest` expects to be rejected (422): a
  `javascript:` link mark is dropped via `continue` before being added
  to the marks array (line ~191); a non-allowlisted embed node is
  dropped entirely (`return null`, line 179); an invalid `textAlign`
  value is normalized away (`cleanAlign()`, no fallback that would
  preserve it). **In all three cases the dangerous/invalid value never
  reaches storage.** The mismatch is that the request still returns 201
  (sanitized-and-accepted) instead of 422 (rejected) — and
  `app/Rules/ValidTipTapDocument.php`'s own docblock documents this as
  a locked design decision ("P4-D1"), not a bug.
- *Severity:* Low (as a live vulnerability — confirmed not exploitable);
  Medium (as a detection/audit-trail gap — an attempted injection is
  silently laundered with no record of the attempt, unlike a rejected
  request which at least surfaces as a 422 in logs/monitoring).
- *Production impact:* No stored-XSS risk confirmed. Real gap: no
  visibility into attempted malicious submissions.
- *Recommendation:* Decide deliberately: either update the 3 tests to
  assert the sanitized-output shape (matching the documented P4-D1
  decision), or add an explicit rejection+log path for clearly-hostile
  patterns (a `javascript:` href is not an honest mistake) so attempts
  are visible to security monitoring.
- *Blocks deployment:* No.

**Finding 3.2 — Privilege escalation is correctly hard-locked.**
- *Evidence:* `app/Support/Authorization/RoleEscalationGuard.php`:
  unconditional rule — only an actor who already holds `super_admin` may
  (a) modify any account that holds `super_admin`, or (b) grant the
  `super_admin` role to anyone. Verified this guard is actually invoked
  from `UpdateUserAction::handle()` before any role sync or field
  update executes. Self-lockout is also prevented (an admin can't strip
  their own last admin role via bulk role sync).
- *Severity:* Informational (positive finding).
- *Production impact:* Strong defense against the most severe class of
  access-control failure (OWASP A01: Broken Access Control /
  privilege escalation).
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.3 — Password-change flow is correctly defended.**
- *Evidence:* `ChangePasswordAction::handle()` calls
  `Hash::check($validated['current_password'], $user->password)` before
  allowing any change (422 on mismatch), and on success revokes all
  *other* API tokens for that user while preserving the current session
  — correct compromise-recovery behavior. Admin-initiated password
  resets (`UpdateUserAction`) additionally rotate `remember_token` and
  revoke all of the target's tokens, treating an admin reset as a
  potential-compromise event.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.4 — Mass assignment is clean across all models.**
- *Evidence:* Scripted check across every file in `app/Models/*.php`:
  zero instances of `guarded = []` or `fillable = ['*']`. `User::$fillable`
  does include `password`, but the model casts it `'password' => 'hashed'`
  (auto-hashing, idempotent) and every write path checked
  (`ChangePasswordAction`, `UpdateUserAction`) handles it deliberately,
  not via raw mass-assignment of unvalidated request data.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.5 — File upload validation is real, not cosmetic.**
- *Evidence:* `StoreMediaAssetRequest` uses `mimetypes:` (true MIME
  sniffing, not extension-trusting) with an explicit allowlist per type,
  separate size caps for image/video/reel-video, and
  `Rule::dimensions()->maxWidth()->maxHeight()` guarding against
  decompression-bomb-style giant images. Storage path uses
  `Str::uuid()` for the filename (`StoreMediaAssetAction.php:49-54`) —
  no user-controlled input reaches the storage path, so no path
  traversal vector.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.6 — Rate limiting is comprehensive, not an afterthought.**
- *Evidence:* Both admin and public login endpoints carry dedicated
  named throttles *plus* reCAPTCHA (`routes/api/v1/admin-auth.php`,
  `routes/api/v1/auth.php`). The entire public read surface has a
  blanket `throttle:public.read` DoS guard (explicitly commented as
  such). Comment submission, contact form (dual-layer: client + IP cap
  per its own comment), external-video-resolve, and numerous
  admin operational endpoints (WhatsApp, migrations, CDN purge, cache
  clear) all carry specific throttles matched to their cost/abuse
  profile (e.g. `throttle:3,1` for the heaviest admin actions).
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.7 — Secrets are encrypted at rest, consistently.**
- *Evidence:* `ThirdPartySettings::encrypted()` explicitly lists every
  third-party secret (OAuth secrets, reCAPTCHA, Firebase, Maps, AI
  provider keys, WhatsApp token, weather/sports API keys). Confirmed
  this list is actually consumed — not just declared — by
  `UpdateThirdPartySettingsAction`, and the identical pattern
  (`::encrypted()` + consuming Action) is repeated for CDN, General, and
  MediaStorage settings.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.8 — CORS is a real allowlist, not a wildcard.**
- *Evidence:* `config/cors.php`: explicit origin list from env, no `*`,
  `supports_credentials: false` with a correct justification (Bearer
  token auth, not cookie-based, so cross-origin credential sharing
  isn't needed).
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.9 — Render-side XSS defense-in-depth is effectively total
in the backend's own views.**
- *Evidence:* Grepped every Blade view for unescaped `{!! !!}` output:
  exactly one hit in the entire `resources/views/` tree, and it is a
  static XML declaration string in the RSS feed template, not user data.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative. (Note: this covers only backend-
  rendered Blade views — the Next.js public frontend and the Vite admin
  frontend are explicitly out of scope for this backend review, per the
  user's own stated review sequencing.)
- *Recommendation:* None for backend scope.
- *Blocks deployment:* No.

**Finding 3.10 — Centralized exception handling prevents information
disclosure.**
- *Evidence:* `app/Support/Responses/ApiExceptionRenderer.php`: every
  major exception type (`ValidationException`, `AuthenticationException`,
  `ThrottleRequestsException`, `AuthorizationException` +
  Spatie/Symfony equivalents, `ModelNotFoundException`,
  `MethodNotAllowedHttpException`) maps to the correct HTTP status, and
  the class's own docblock states the explicit policy: never expose a
  raw `getMessage()` from any exception (framework or vendor) to the
  client.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — reduces OWASP A05
  (Security Misconfiguration) / information-disclosure risk.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 3.11 — Entity-tagging endpoint authorization (this session's
own recent work) is symmetric and correct.**
- *Evidence:* Every `entities` route (`GET/PATCH` for article/video/
  reel) carries its own correctly-scoped `permission:{type}.edit`
  middleware (`routes/api/v1/admin.php:1136-1155`) — verified directly,
  not assumed. `EntityController` itself has no inline authorization
  (by design — enforcement lives at the route layer, consistent with
  the rest of the app).
- *Severity:* Informational (positive finding). Note:
  `EntityManagementTest.php` only asserts the 403 case for the Article
  variant explicitly — a test-coverage gap (Low), not an authorization
  gap.
- *Production impact:* None negative.
- *Recommendation:* Add the missing 403 test assertions for Video/Reel
  for completeness (cheap, not urgent).
- *Blocks deployment:* No.

**Finding 3.12 — PARTIALLY RESOLVED: dependency CVEs checked and fixed;
remaining gaps stated honestly.**
- *Evidence:* `composer audit` found 25 advisories across 15 packages
  (several high severity, including `laravel/framework` CRLF injection,
  `spatie/laravel-medialibrary` file-upload-restriction bypass, and
  `symfony/http-kernel` HEAD-request authorization-filter bypass) — all
  25 resolved via a targeted `composer update` within existing
  `composer.json` constraints (zero constraint changes), re-confirmed
  clean by an independent `composer audit` re-run, and the full 2029-test
  suite shows zero regression. `npm audit` on the root project and
  `admin-frontend`'s production dependencies found and fixed 2 real
  production-facing issues (`form-data` CRLF injection, `react-router`
  open redirect) plus dev-tooling-only issues left as a documented,
  non-blocking follow-up (would require a breaking Vite major-version
  bump for zero production impact).
- *Still not checked in this pass:* SSRF surface on any endpoint that
  fetches a user-supplied URL server-side (e.g. `media/external/resolve`
  — rate-limited, per 3.6, but not tested for SSRF specifically),
  session/token fixation edge cases beyond what was directly traced,
  and infrastructure-level hardening (server, network, WAF).
- *Severity:* Informational for the resolved half; cannot assess the
  remaining half — explicitly unverified, not claimed clean.
- *Production impact:* Dependency CVEs are now remediated. Remaining
  gaps' impact is unknown.
- *Recommendation:* A dedicated `/security-review` or external pentest
  pass covering specifically the still-unchecked items before or
  shortly after launch.
- *Blocks deployment:* Not established either way — flagged as an open
  question, not a confirmed blocker.

---

## 4. Database

**Finding 4.1 — Foreign key cascade behavior is 100% explicit across
the entire migration history.**
- *Evidence:* Scripted check across all 134 migration files: zero
  instances of `constrained()` without an explicit
  `cascadeOnDelete()`/`nullOnDelete()`/`restrictOnDelete()`/`onDelete()`
  qualifier.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — eliminates an entire class of
  "what happens when the parent row is deleted" surprises.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 4.2 — `articles`' FULLTEXT-driven COPY-rebuild constraint.**
- Covered in Finding 2.2 (cross-referenced here since it's equally a
  database finding as a performance one).

**Finding 4.3 — Phase 1's 4 migrations are rollback-safe (carried
forward from this session's Task 14, re-stated for completeness).**
- *Evidence:* Full `migrate` → `migrate:rollback --step=5` →
  schema-verified-clean → `migrate` round-trip proven against a
  disposable SQLite database in this session's Task 14 work.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 4.4 — PARTIALLY RESOLVED: no dead columns found in the 10
core content tables checked; full-schema sweep still not done.**
- *Evidence:* Wrote a script cross-referencing every column in the 10
  core content tables (`articles`, `videos`, `reels`, `broadcasts`,
  `media_assets`, `entities`, `content_entity`, `categories`,
  `video_categories`, `broadcast_categories` — ~230 columns) against
  `grep` hits across `app/`, `database/`, `tests/`, `routes/`. First
  run flagged every column including obviously-used ones like
  `articles.title` — a bug in the script (Windows `D:` drive paths have
  a colon, which shifted `awk -F:`'s field numbering; fixed by using
  `$NF` instead of `$2`). After the fix: **zero columns** across all 10
  tables had 1 or fewer references — every column, including the
  Task 4/9 deliberately-reserved-for-later ones
  (`external_ref`, `content_entity.status/confidence`, `tenant_id`),
  is referenced at least at its migration + model declaration.
- *Not covered:* the other ~40 tables in the schema (settings, ads,
  notifications, polls, WhatsApp, etc.) were not swept — scoped to core
  content tables given the size of everything else in this review.
- *Severity:* Informational for what was checked; cannot assess the
  rest.
- *Production impact:* None found in the checked scope.
- *Recommendation:* Re-run the same script (now fixed) against the
  remaining tables if a full-schema sweep is wanted.
- *Blocks deployment:* No.

---

## 5. API

**Finding 5.1 — Response envelope consistency is genuinely universal.**
- *Evidence:* `ApiResponse::` (the shared success/error envelope) is
  used in 417 call sites across 250+ files spanning every domain
  (Content, Advertising, Broadcast, Epaper, Chat, Polls, WpMigration,
  Team, etc.) — not just Phase 1's additions.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — consistent client-side handling.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 5.2 — Public API backward compatibility (carried forward from
this session's Task 14).**
- *Evidence:* Route diff between the pre-Phase-1 baseline and current
  HEAD: 511→519 routes, zero removed, zero middleware changes on
  existing routes, all 8 additions accounted for as Task 12's entity
  endpoints.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

---

## 6. Events

**Finding 6.1 — Zero duplicate listener registrations (freshly
re-verified, not trusted from the prior pass).**
- *Evidence:* Re-ran `php artisan event:list` fresh in this session:
  exactly 3 listeners each for `ArticleStatusChanged`/
  `ReelStatusChanged`/`VideoStatusChanged`, none duplicated.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 6.2 — Event dispatch is correctly positioned after transaction
commit.**
- *Evidence:* `TransitionArticleStatusAction.php:57`: `event(new
  ArticleStatusChanged(...))` is called after the `DB::transaction()`
  closure returns, not inside it — confirmed by reading the actual
  code structure, not assumed from a comment.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — listeners (cache invalidation,
  CDN purge, notification) never act on data from a transaction that
  could still roll back.
- *Recommendation:* None.
- *Blocks deployment:* No.

---

## 7. Caching

**Finding 7.1 — Cache stampede protection is real and well-engineered.**
- *Evidence:* `app/Support/Cache/CachedRead.php`: `Cache::lock()`-based
  single-flight guard, blocking concurrent waiters up to 5 seconds,
  double-checks the cache after acquiring the lock, falls back safely
  to a direct (uncached) computation on lock timeout rather than
  deadlocking, and distinguishes a cached `null` result from a true
  cache miss (preventing a stampede on legitimately-empty results). The
  class's own docblock names the exact scenario it defends against
  ("breaking news / viral article" concurrent cache-miss storm).
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — this is exactly the kind of
  protection a real news site needs for viral-traffic moments.
- *Recommendation:* None for what's covered; see Finding 2.3 for the
  coverage-completeness caveat (not verified for all 5 content types).
- *Blocks deployment:* No.

---

## 8. Search

**Finding 8.1 — Search-sync resilience is proven (carried forward from
Task 14, re-cited as directly relevant here).**
- *Evidence:* With Meilisearch genuinely unreachable in this
  environment, called `$reel->searchable()` directly: the save
  succeeded without throwing, and `storage/logs/laravel-*.log` showed
  the expected `search.sync_failed` warning with full exception detail
  — the failure is caught and logged, not silently swallowed.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative for the write path.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 8.2 — No automated drift/health monitoring for 4 of 5
searchable content types.**
- *Evidence:* `app/Health/Checks/` contains 8 health checks total,
  including `EpaperSearchHealthCheck` — but nothing equivalent for
  Article, Video, Reel, or Broadcast.
- *Severity:* Medium.
- *Production impact:* If Meilisearch experiences an extended outage,
  `ResilientSearchable` correctly keeps the site's write path (article
  publishing, etc.) working, but search results for these 4 types will
  silently grow stale with **no automated alert** telling anyone this
  is happening — unlike Epaper, which has exactly this monitoring.
- *Recommendation:* Extend the health-check pattern already proven for
  Epaper to the other 4 searchable types before or shortly after launch.
- *Blocks deployment:* No — the underlying write-path resilience is
  solid; this is an observability gap, not a functional break.

---

## 9. Notifications

**Finding 9.1 — Queue configuration and retry policy are deliberate, not
default-left-unconsidered.**
- *Evidence:* Production queue driver is `redis` (`.env.example:41`).
  Notification jobs implement `ShouldQueue` correctly. Sampled 10 job
  classes' `$tries` values: they vary sensibly by risk profile (1 try
  for best-effort/non-idempotent-unsafe jobs like WhatsApp dispatch and
  frontend cache revalidation, 2-3 tries for jobs worth retrying like
  Epaper OCR and media mirroring).
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 9.2 — Notification list endpoint is correctly scoped to the
authenticated user.**
- *Evidence:* `ListMyNotificationsAction` uses `$actor->notifications()`
  (Laravel's `Notifiable` relation, scoped by `notifiable_id` implicitly)
  — read the actual implementation, not just the docblock's claim.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 9.3 — Broadcast push notifications are an honest stub, not a
real delivery mechanism.**
- *Evidence:* `app/Support/Broadcast/BroadcastPushGateway.php`: its own
  docblock states Firebase *Messaging* is not configured yet (only
  Firebase *Storage* is used) — `publish()` currently only
  `Log::info()`s the intended push and explicitly does **not** claim
  fake delivery. A `TODO(FCM)` marks where the real FCM HTTP v1 call
  belongs.
- *Severity:* High if push notifications for live/breaking broadcast
  content are expected to function at launch; Informational if this is
  understood and accepted as a documented post-launch item.
- *Production impact:* Users will not receive push notifications for
  broadcast/live events — they will only be logged server-side. This
  is easy to miss because nothing *fails* — the code path completes
  successfully every time, it just doesn't reach a device.
- *Recommendation:* Get an explicit product/stakeholder decision on
  whether broadcast push is a launch requirement. If yes, this blocks
  launch until FCM is wired in. If no, this needs to be documented
  as a known, accepted gap — not discovered by a confused user report.
- *Blocks deployment:* **Conditional — yes, if broadcast push is a
  stated launch requirement; no, if it is explicitly deferred.** This
  is a product decision this review cannot make unilaterally.

---

## 10. Media

**Finding 10.1 — Orphaned media cleanup is real and scheduled.**
- *Evidence:* `media:prune-orphans` is registered in
  `SchedulerRegistry` at `15 4 * * *` (daily 04:15), explicitly marked
  `critical: false`.
- *Severity:* Informational (positive finding).
- *Production impact:* None negative — prevents unbounded storage
  growth from abandoned uploads.
- *Recommendation:* None.
- *Blocks deployment:* No.

**Finding 10.2 — Rights/license/expiry fields (Task 8) are additive and
inert, as designed.**
- *Evidence (carried forward, consistent with this session's own
  Task 8 work):* `license_type`/`rights_expiry_at`/`usage_terms` are
  nullable columns with no enforcement logic yet — by design, since no
  UI consumes them and no taxonomy was requested at the time.
- *Severity:* Informational.
- *Production impact:* None — no rights expiry is currently enforced
  anywhere, which is expected given no feature consumes this data yet.
  Not a defect; a known, deliberate scope boundary.
- *Recommendation:* None for deployment; relevant whenever a rights-
  enforcement feature is actually built.
- *Blocks deployment:* No.

**Finding 10.3 — PARTIALLY RESOLVED: configuration code verified
correct; live connectivity still not (and cannot be) checked here.**
- *Evidence:* Read the full R2 configuration chain. `config/filesystems.php`'s
  `s3` disk uses the standard AWS-named env vars against R2's S3-compatible
  API (correct — R2 doesn't have its own Laravel driver). More importantly,
  `App\Support\Media\RemoteStorage::configureDisk()` overrides this at
  runtime from the admin-editable `MediaStorageSettings`, with
  `region` defaulting to `'auto'` and `use_path_style_endpoint` — both
  match Cloudflare R2's documented requirements exactly. It fails safe:
  if `remote_key`/`remote_bucket` are empty, it returns without building
  the disk (falls back to local storage) rather than crashing, and
  deliberately doesn't wipe the disk config so `Storage::fake()` still
  works in tests. `remote_key`/`remote_secret` are both in
  `MediaStorageSettings::encrypted()` — encrypted at rest, matching the
  same pattern already confirmed for every other third-party secret.
- *Still not verifiable here:* actual production bucket permissions,
  CDN cache-control header correctness, and whether real R2 credentials
  are actually configured in the production environment — this sandbox
  has no network path to a real Cloudflare account.
- *Severity:* Informational for the code path (correct); cannot assess
  the live infrastructure.
- *Production impact:* None found in the code. Live verification is a
  deployment-environment check, not a code-review one.
- *Recommendation:* Confirm directly against the real production R2
  bucket/credentials before launch — this is inherently outside what a
  code audit can prove.
- *Blocks deployment:* No.
- *Blocks deployment:* Not established either way.

---

## 11. Code Quality

**Finding 11.1 — CORRECTED: not dead code, two live API surfaces for
one setting.**
- Covered in Finding 1.3 (retracted and corrected during Task D's
  re-verification pass — the original claim was based on a grep with
  incorrectly escaped namespace separators that produced a false
  negative; all four files are live, imported, and covered by 20
  passing tests). No deletion performed.

**Finding 11.2 — TODO/FIXME sweep across the entire `app/` directory
(not just Phase 1's diff) found 4 hits, all low-severity and honest.**
- *Evidence:* `app/Modules/Notifications/Dispatch/DirectDispatcher.php`
  defers a user-resolution step explicitly to "Phase 4" (a planned,
  documented deferral, not hidden debt). `app/Support/Broadcast/BroadcastPushGateway.php`'s
  TODO is Finding 9.3 above. Two others are cosmetic WP-migration UI/
  route cleanup reminders, one of which duplicates an already-known
  pre-Phase-1 TODO in `routes/api/v1/admin.php:1071`.
- *Severity:* Low (all four), except where a TODO maps to a substantive
  finding already called out at its own severity (9.3).
- *Production impact:* Minimal — these are self-disclosed, not
  discovered gaps.
- *Recommendation:* Track normally; none are urgent.
- *Blocks deployment:* No.

**Finding 11.3 — Translation-key drift across content-type workflow
messages (carried forward, re-confirmed present in this pass).**
- *Evidence:* `article.schedule_requires_future_date` /
  `video.schedule_requires_date` / `reel.schedule_future` — three
  different i18n keys for the same validation rule. Re-grepped in this
  pass to confirm it still exists exactly as previously documented.
- *Severity:* Low — cosmetic, zero functional impact.
- *Production impact:* None.
- *Recommendation:* Unify if convenient during unrelated work; not
  worth a dedicated task.
- *Blocks deployment:* No.

**Finding 11.4 — Two parallel workflow systems (Article/Video/Reel
unified; Broadcast/Page not) — architectural fact, not a defect.**
- *Evidence:* `app/Support/Content/Workflow/EditorialWorkflowGuard.php`
  is used by exactly 3 thin wrappers
  (`ArticleWorkflowGuard.php`/`VideoWorkflowGuard.php`/`ReelWorkflowGuard.php`).
  No equivalent file exists for Broadcast (verb-specific lifecycle
  Actions instead, by deliberate design) or Page (out of scope,
  unexamined).
- *Severity:* Informational.
- *Production impact:* None — both systems work correctly for what they
  cover; this is ongoing cognitive load for new contributors ("it
  depends which content type"), not a functional risk.
- *Recommendation:* None required for deployment.
- *Blocks deployment:* No.

---

## 12. Production Readiness

**Can this backend safely serve production?** Yes, with the specific
named exceptions above tracked, not ignored.

**Would you personally approve deploying it?** Yes — contingent on
resolving Finding 9.3 (broadcast push) as an explicit product decision
rather than silently assuming it works, and with the acknowledged blind
spots (3.12, 4.4, 10.3) understood as *unverified*, not *cleared*.

**Remaining risks, sorted (post-remediation — see Tasks A-F, applied
after the original review):**

| # | Finding | Status | Severity | Blocks deployment |
|---|---|---|---|---|
| 9.3 | Broadcast push is a stub, not real FCM delivery | Hardened: fails loudly if misconfigured, health-checked, config-only activation path designed | High (conditional) | Conditional on product requirement |
| 2.1 | Article-list COUNT costs ~1.4s per cache-miss window | Mitigated: cache TTL extended, cuts frequency up to 6x | Low (was Medium) | No |
| 2.2/4.2 | `articles`' FULLTEXT index forces slow COPY rebuilds on any future schema change | Documented: ADR-E8 + migration checklist | Medium (procedural, not code) | No |
| 8.2 | No search-drift monitoring for Article/Video/Reel/Broadcast | **Resolved**: 4 new health checks, DB-vs-index drift comparison | Closed | No |
| 3.1 | Sanitizer silently launders rather than rejects+logs dangerous input | Open — needs a product/security decision, not a code fix | Low/Medium | No |
| 1.3/11.1 | ~~Dead CDN-settings code~~ | **Retracted** — re-verification found these files live, tested, and in active use; nothing deleted | N/A | No |
| 11.3 | Translation-key drift (cosmetic) | Open, low priority | Low | No |
| 3.12 | Dependency CVEs | **Resolved**: 25 composer + 3 npm production CVEs fixed, zero test regressions | Closed | No |
| 2.3 | Cache coverage across all 5 content types | **Resolved**: confirmed consistent, all use the same stampede-protected wrapper | Closed | No |
| 4.4 | Dead columns (core content tables) | **Resolved for 10 core tables**: zero found; full-schema sweep still open | Partially closed | No |
| 10.3 | R2/Cloudflare config | **Resolved (code-level)**: correct, encrypted, fails safe; live infra still unverifiable from this environment | Partially closed | No |

**Which risks are blockers?** None outright. Finding 9.3 remains the
one conditional item — it blocks *if and only if* broadcast push is a
stated launch requirement, which is a product question, not something
this review can resolve unilaterally.

**Which are acceptable?** Every remaining Medium/Low finding is
acceptable to ship with, provided it stays tracked — none represent
active exploitation risk or a confirmed functional break.

---

## Scores

Updated from the original review to reflect Tasks A-F's remediation.

- **Overall Architecture Score: 72/100** (+2) — Unchanged assessment of
  what's built (still solid, still far from the ratified target
  architecture by design, not drift). Small increase: Finding 1.3's
  retraction removed a false "duplication debt" mark, and the two live
  CDN API surfaces it actually found are a real but minor, already-
  understood design question, not new drift.

- **Security Score: 90/100** (+5) — 25 composer CVEs (several high,
  including an authorization-filter bypass and a file-upload-restriction
  bypass in the media library) and 3 production-facing npm CVEs are now
  fixed with zero test regressions. Remaining deduction: the sanitizer
  contract question is still open, and SSRF/infra-hardening/session-
  fixation remain explicitly unverified.

- **Performance Score: 80/100** (+5) — The COUNT-query cost is now
  further mitigated (longer TTL, safely, with a time-travel test proving
  the boundary) after investigating and rejecting a fragile index-hint
  alternative. Search-index drift — a real observability gap — is now
  fully monitored across all 4 remaining content types.

- **Maintainability Score: 82/100** (+4) — The corrected CDN finding is
  itself a maintainability win: false "dead code" claims are worse than
  no claim, and catching it before deleting live, tested code is exactly
  what the re-verification discipline is for. Two new ADRs (E8) and
  three new architecture docs (search health, broadcast push, migration
  safety) further strengthen the documentation trail.

- **Scalability Score: 68/100** (+3) — No structural change (Projections
  still don't exist, by design, per the Evolution Roadmap), but the
  COUNT-query mitigation and full search-health coverage both reduce
  near-term scaling risk within the current architecture.

- **Production Readiness Score: 88/100** (+8) — Zero critical or
  confirmed-exploitable findings, dependency CVEs resolved, search
  observability closed, cache coverage confirmed, R2 config verified at
  the code level. What's left is one conditional product decision
  (broadcast push) and a small number of explicitly-scoped, honestly-
  disclosed gaps (SSRF, full-schema dead-column sweep, live R2
  connectivity) that don't need to gate launch.

---

## Would you deploy?

## YES

**Technical justification:** Every Critical-tier risk category checked
across both passes of this review — privilege escalation, mass
assignment, SQL injection surface, stored/reflected XSS, CSRF/CORS
misconfiguration, secrets-at-rest, authentication/rate-limiting,
migration rollback safety, event/transaction-ordering correctness,
public API backward compatibility, and now dependency CVEs — came back
clean or was actively fixed, with direct evidence at every step, not
assumption. The one High-severity finding (9.3, broadcast push) is
conditional on a product requirement this review cannot adjudicate, and
is now hardened to fail loudly and health-checked rather than silently
degrading. Every Medium finding from the original pass has since been
mitigated, resolved, or turned into a documented procedure (ADR-E8).
The explicitly unverified areas that remain (SSRF testing, full-schema
dead-column sweep, live R2/Cloudflare connectivity, infra hardening)
are honestly disclosed as unknown rather than claimed safe, and are
appropriately a post-launch or parallel-track item, not a launch gate.
