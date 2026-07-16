# Phase 1 — Production Readiness Report

**Task 14 deliverable.** This is the final verification gate for Phase 1
as a whole — not another per-task regression run, but a from-scratch,
evidence-based audit of everything Tasks 4–13 changed, compared against
an isolated baseline. Every claim below is backed by a command actually
run and output actually read in this session; nothing here is asserted
from memory of the individual task reports.

**Verdict: production ready, with one operational caveat** (migration
deployment procedure for `articles` — see §4).

---

## Methodology

- **Baseline:** commit `5b141d3c4` (the last commit before Task 4),
  checked out into an isolated `git worktree` at `D:/gasem-baseline`
  with its own `composer install` and `npm run build` — a fully
  independent environment, not a stash/checkout of the working copy.
- **HEAD:** commit `185dd7847` (Task 13 complete), the working directory
  as it stands.
- **Phase 1 span:** 33 commits, `5b141d3c4..HEAD`.
- Every comparison below is baseline vs. HEAD on this exact pair, using
  the same database engine (MySQL 8.4.3 for live checks; SQLite
  `:memory:` for the Pest suite, per `phpunit.xml`).

---

## 1. Full regression suite — before/after

First baseline run surfaced 39 failures vs. HEAD's 14 — investigated
before accepting either number. Root cause: the fresh worktree had no
built frontend assets, so every test rendering a Blade view calling
Laravel's Vite helper threw `ViteManifestNotFoundException` (15
`BroadcastPageTest` cases, 9 `Epaper*Test` cases, 1
`BroadcastCoverMediaTest` case — all concentrated in view-rendering
tests, confirming the pattern). Fixed by running `npm run build` in the
baseline worktree; re-ran the full suite from scratch for a clean
number.

**Final, clean result:**

| | Tests | Passed | Failed | Errors | Assertions |
|---|---|---|---|---|---|
| Baseline (`5b141d3c4`) | 1941 | 1923 | 14 | 4 | 6256 |
| HEAD (`185dd7847`) | 2008 | 1990 | 14 | 4 | 6395 |
| Delta | **+67** | +67 | **+0** | **+0** | +139 |

- **Failure set is byte-identical** between baseline and HEAD (same 14
  test names, verified by set comparison, not just count).
- **Error set is byte-identical** (same 4 `WriterArticleMediaTest` cases
  — a missing `publicWriterToken()` test helper, pre-existing, unrelated
  to Phase 1).
- **+67 tests reconciles exactly** to the documented new tests added
  across Phase 1: Task 4 (7) + Task 5 (5) + Task 6a (11) + Task 6b (8) +
  Task 7 (10) + Task 8 (3) + Task 10 (8) + Task 12a (15) = **67**.

**Zero regressions in the full suite.** All 14 pre-existing failures
were independently reproduced on the untouched baseline commit, so none
of them were introduced by Phase 1 — they were already broken before
Task 4 started (already tracked separately: `task_a9fe3b88` for the
sanitizer gaps, `task_47f36988` for the writer-notification 403, and
the `canonicalPath()` vs. test-expectation mismatch noted in Task 4's
own entry).

## 2. Public API backward compatibility

Diffed `php artisan route:list --json` between baseline and HEAD (511
routes → 519 routes):

- **Routes removed: 0.**
- **Routes with changed middleware: 0** (checked every route present in
  both snapshots).
- **Routes added: 8** — exactly Task 12a's entity endpoints
  (`GET/POST /admin/entities`, `GET/PATCH /admin/{articles,videos,reels}/{id}/entities`).
  Nothing unaccounted for.

## 3. Migration rollback safety

All 4 Phase 1 migrations reviewed individually (`create_entities_table`,
`create_content_entity_table`, `add_rights_metadata_to_media_assets`,
`reserve_tenant_id_on_core_content_tables`) — each has a correct,
complete `down()`.

**Empirically proven, not just read:** ran the full migration chain
(`migrate` → `migrate:rollback --step=5` → schema-verified clean →
`migrate` again) against a disposable SQLite file. Confirmed via
`Schema::hasTable()`/`hasColumn()` that `entities`, `content_entity`,
`media_assets.license_type/rights_expiry_at/usage_terms`, and
`articles.tenant_id` were all correctly removed on rollback and correctly
restored on re-migration, in the right dependency order (`entities`
before `content_entity`, since the latter has an FK to the former).

## 4. Migration performance — one real finding

Task 9's original write-up claimed reserving `tenant_id` on 11 tables
was "cheap now (tables far from 2M+ rows on most of them)." This is
true for 10 of the 11 tables. It is **not accurate for `articles`**
(217,460 rows), and this was not previously measured — only assumed
from row count alone.

**What was actually checked:** `articles` carries a `FULLTEXT` index
on `title`. Empirically forcing each ALTER algorithm in turn against
the real table:

- `ALGORITHM=INSTANT` → **rejected** by MySQL 8.4.3 (error 1846: "InnoDB
  presently supports one FULLTEXT index creation at a time").
- `ALGORITHM=INPLACE` → **rejected**, same reason.
- `ALGORITHM=COPY` → **accepted**, and timed at **177 seconds** against
  the real 217,460-row table (transient test column added then
  immediately dropped — no lasting schema change from this test).

A `COPY`-algorithm `ALTER TABLE` blocks writes to the table for its
full duration. This migration has already run against the local
database without incident (177s, one-time, already paid), but if it
has **not yet been applied to the production database**, whoever
deploys it should schedule that specific step during a low-traffic
window and expect a multi-minute write-blackout on `articles` — not
let it run as an unattended line in a routine `php artisan migrate`
deploy step. This has been added as a correction to Task 9's entry in
[`PHASE1-PROGRESS.md`](PHASE1-PROGRESS.md).

No other Phase 1 migration touches a FULLTEXT-indexed table, and no
other performance regression was found in migrations.

## 5. Cache invalidation, search, and notifications — verified live, not just tested

These three cross-cutting systems are exercised by the Pest suite, but
Pest runs against test doubles/drivers (`array` cache, no real Scout
transport). To close that gap, each was verified directly against the
**real configured drivers** (`CACHE_STORE=redis`, `SCOUT_DRIVER=meilisearch`,
database notifications, `QUEUE_CONNECTION=sync`):

- **Cache invalidation:** wrote a probe value under a real article's
  exact `ArticleCacheTags::writeTags()` tag set in real Redis, dispatched
  a real `ArticleStatusChanged` event (not a fake), confirmed the probe
  was gone afterward. Tags included real Arabic category slugs — unicode
  handling confirmed correct.
- **Search resilience:** Meilisearch is not running in this sandbox
  (connection refused on 127.0.0.1:7700) — an environment fact, not a
  defect. Used it as a real test of `ResilientSearchable`'s specific
  promise ("a transport failure logs a warning, never fails the save"):
  called `$reel->searchable()` directly against the dead backend. The
  save did not throw. `storage/logs/laravel-2026-07-06.log` shows the
  exact expected entry: `search.sync_failed` with the real
  `CommunicationException` message, model class, logged as a warning —
  proving the failure is caught **and remains observable to ops**, not
  silently swallowed.
- **Notifications:** dispatched a real `ArticleStatusChanged` event
  against a real author; confirmed a new `App\Notifications\ContentStatusChanged`
  row appeared in the `notifications` table with the correct
  `content_id`/`title`/`slug`/`status` payload. Test row deleted after
  verification.

All three work correctly end-to-end against real infrastructure.

## 6. Architectural drift hunt

Specifically hunted for the failure classes already caught once during
Phase 1 execution (to confirm they didn't recur elsewhere) plus a fresh
sweep:

- **Duplicate listener registration** (the exact bug Task 5 hit once):
  `php artisan event:list` shows exactly 3 listeners per status-change
  event (Article/Video/Reel), none duplicated. Confirmed `VideoStatusChanged`
  still correctly uses `RevalidateVideoFrontendOnStatusChanged` in place
  of a CDN-purge listener — the known, documented gap, not a new one.
- **Permission/metadata array mismatch** (the exact bug Task 12 hit
  once, for `entities`): systematically diffed all 28 permission group
  keys against all 28 group-metadata keys in `RolesAndPermissionsSeeder`
  — **zero mismatches**. The `entities` gap found during Task 12's live
  verification was isolated to that one addition and is not a symptom
  of a wider problem.
- **Translation key drift**: confirmed `article.schedule_requires_future_date`
  vs. `video.schedule_requires_date` vs. `reel.schedule_future` still
  exist as three separate keys for the same rule — exactly as Task 6
  already disclosed, not worse.
- **Model-audit convention compliance**: `App\Models\Entity` (new in
  Task 4) correctly uses `AuditsChanges` with a real attribute
  whitelist; `MediaAsset`'s whitelist correctly includes Task 8's three
  new fields.
- **TODO/FIXME/HACK sweep** across every PHP file Phase 1 touched: one
  hit (`routes/api/v1/admin.php`), confirmed via `git show` to already
  exist verbatim in the baseline commit — pre-existing WP-migration
  debt, unrelated to Phase 1.
- **N+1 check** on the new entity-tagging read path: eager-loading
  `Article::with('entities')` produces exactly 2 queries (article +
  one batched `content_entity` join), no N+1.
- **Entity search query shape**: `ListEntitiesAction` uses a
  leading-wildcard `LIKE '%q%'`, which can't use the `(type,name)`
  index for the text match. Confirmed this exactly mirrors
  `ListTagsAction`'s existing, already-accepted pattern for the same
  reason (small, editorially-curated dataset, no cache) — not a new
  anti-pattern, though worth revisiting if the entities table ever
  grows into the tens of thousands.

No new drift found beyond what Phase 1's own task reports already
disclosed, plus the two findings in §4 and this section's search-query
note (both non-blocking).

## 7. Production readiness verdict

**Ready to deploy**, conditional on:
1. Scheduling the `2026_07_06_130000_reserve_tenant_id_on_core_content_tables`
   migration's production run during a low-traffic window (§4), if it
   has not already been applied there.
2. Running `php artisan db:seed --class=RolesAndPermissionsSeeder` (or
   equivalent) after deploy on any environment seeded before this
   migration, so the `entities.*` permissions actually reach
   `super_admin` — the exact gap hit locally during Task 12's live
   verification, fixed there with a direct grant; production will hit
   the same thing if the seeder isn't re-run.

Everything else — regression suite, API compatibility, migration
reversibility, cache/search/notification behavior, architectural
consistency — is clean with no outstanding action items.
