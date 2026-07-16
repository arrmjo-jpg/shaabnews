# AlphaCMS Backend Audit — Pre-Phase-2 Review

Requested scope: architecture, domain model, module boundaries, code
quality, technical debt, performance bottlenecks, scalability, security,
AI readiness, maintainability, production readiness. Every previous
architectural decision is in scope for challenge, with evidence.

**A note on methodology, stated plainly rather than glossed over:** this
audit was originally planned around four parallel deep-dive
investigations (domain model, code quality, performance, security). All
four hit the account's session usage limit before writing any output —
their transcript files are 0 bytes despite real tool activity (22–75
tool calls logged each). Rather than re-spawn agents into the same
limit, every finding below was gathered directly, with my own tool
calls, cited to file:line. Coverage is therefore narrower than a full
exhaustive sweep would be — it prioritizes the highest-value, most
checkable claims per dimension over exhaustive enumeration. Where a
claim rests on established context from earlier in this session (e.g.
Phase 1's own task-by-task findings) rather than a fresh check run just
now, that's noted explicitly.

---

## 1. Architecture — target vs. reality

The team ratified a full target architecture (`docs/architecture/TARGET-ARCHITECTURE.md`,
`docs/adr/001`–`016`) recently. It is explicitly a **future** state. Checked
what's actually built today against three of its core pillars:

**ADR-001 (`ContentItem` generic core) — not built, correctly deferred.**
Confirmed: Article, Video, Reel, Broadcast, Page are five fully
independent Eloquent models with five independent tables, five
independent Controller/Action/Resource stacks. No shared base model, no
shared interface for the "envelope" concerns (status, SEO, slug,
publishing). This is exactly what `docs/adr/E1-defer-content-item-unification.md`
says should be true right now — verified, not assumed.

**ADR-003 (CQRS-lite / Projections) — not built at all.** Grepped for
any Projection/read-model/ComposedDocument concept: none exists.
Traced the public article-list path (`app/Actions/Public/Content/ListPublicArticlesAction.php`)
end to end: it queries `articles` directly (or Meilisearch directly for
search terms), same table the admin writes to. There is a Redis
response-cache layer in front of it (`Cache::remember(..., CacheKeys::publicArticlesList(...))`),
which gives some of CQRS-lite's *read-side scaling* benefit without any
of its *structural* separation — the cache is a TTL'd memoization of a
live query, not a maintained, event-updated read model. This matters
for Phase 2 planning: Stage 1 of the roadmap (Read Plane + Events) is
listed as "next" but essentially unstarted on the read side — Phase 1
built the event spine (Stage 1's other half) but zero Projections yet.

**ADR-014 (modular monolith) — partially real, mostly aspirational.**
`app/Modules/` contains exactly **2** of the ~12 bounded contexts the
target architecture names: `CDN` and `Notifications`. Everything else —
Content, Media, Advertising, Analytics, Identity, Search, AI — lives in
the flat, shared `app/Models` (74 files), `app/Http/Controllers` (102
files), `app/Actions/{Admin,Public,Sport}` structure with no enforced
boundary. This isn't a defect — Phase 1 never claimed to do this work —
but it means "modular monolith" describes 2 modules today, not the
whole app. Worth an honest line in any status report to leadership: the
target architecture is ratified, almost none of its structural
consequences have landed yet.

**Verdict:** Phase 1 did exactly what it said — an event spine and a
handful of additive schema/feature slices — and did not (and correctly
did not try to) touch the deeper architectural shape. The gap between
current reality and the target is still nearly the whole distance.
Phase 2 should not assume any structural head start beyond the event
spine itself.

## 2. Domain model & duplication

Three of five content types (Article, Video, Reel) now share one
`EditorialWorkflowGuard` engine (Task 6), verified present at
`app/Support/Content/Workflow/EditorialWorkflowGuard.php` with thin
per-type wrappers (`ArticleWorkflowGuard.php`, `VideoWorkflowGuard.php`,
`ReelWorkflowGuard.php`). Broadcast and Page have **no** equivalent file
— confirmed via search, not assumed. Broadcast's verb-specific lifecycle
(`StartBroadcastAction`, `EndBroadcastAction`, etc.) is a genuinely
different shape, already documented as an intentional exclusion, not a
gap. Page's simpler lifecycle was out of Task 6's scope and remains
unexamined by this audit — worth a follow-up look before Phase 2 if Page
workflow ever needs to grow more complex.

File-size sweep across `app/` found no God classes: largest files are
`HtmlToTipTap.php` (528 lines, a content-format converter — plausible
size for that job) and `AppServiceProvider.php` (523 lines, growing
because Phase 1 added `configureContentEvents()` to it — worth watching
if more phases add more `configure*()` blocks here without ever
splitting it). No admin Controller exceeds 220 lines; the
Controller→Action thin-delegation pattern is holding up structurally.

## 3. Code quality & technical debt

**Already-tracked items, re-verified rather than re-discovered:**

- **`ArticleEditorContractTest`'s 3 "failing" sanitizer tests are not a
  live vulnerability.** Traced `TipTapSanitizer::clean()` (`app/Support/Content/TipTapSanitizer.php`)
  line by line for all three cases: a `javascript:` link mark is
  dropped by `continue` at line 191–193 before the mark array is ever
  built; a non-allowlisted embed node is dropped entirely (`return null`,
  line 179); an invalid `textAlign` value is normalized away by
  `cleanAlign()` (line 256–263, an allowlist that doesn't even include
  the input value as a fallback). **The dangerous payload never
  reaches storage in any of the three cases.** What's actually wrong is
  a contract mismatch: the rule's own docblock (`app/Rules/ValidTipTapDocument.php`)
  documents "P4-D1" as a *locked decision* to sanitize-and-accept
  (200/201) rather than reject (422) — and the tests were written
  expecting the reject behavior. This needs a decision, not a fix:
  either update the 3 tests to assert the sanitized output shape
  instead of a 422, or — the stronger security argument — add an
  explicit rejection path for clearly-malicious input (a `javascript:`
  href submission is not an honest editing mistake) so attempts get
  logged and surfaced rather than silently laundered. Recommend the
  latter before Phase 2, since silently sanitizing likely-hostile input
  with no record of the attempt is a weaker security posture than it
  needs to be, even though nothing is exploitable today.
- **`canonicalPath()` vs. slug-based test expectations**: not
  independently re-verified this session (would require tracing the
  public URL-resolution path fresh); relying on Phase 1's existing
  characterization of this as a real, separate, already-tracked gap.
  Flagging that this audit did not re-derive it from scratch.
- **Video's missing revision recording / CDN-purge class**: consistent
  with what Task 6/6b already documented; not re-litigated here.
- **Translation key drift** (`article.schedule_requires_future_date` /
  `video.schedule_requires_date` / `reel.schedule_future`): re-confirmed
  present, cosmetic (i18n key naming only), zero functional impact.

**Fresh findings:**
- Zero `dd()`/`var_dump()` left in `app/`. Zero raw string-interpolated
  SQL found in the areas checked (Eloquent/query-builder used
  throughout — see §7 for the security-specific pass on this).
- One pre-existing TODO (`routes/api/v1/admin.php:1071`, about disabling
  a WordPress quick-migration route in production) — confirmed via
  `git show` to predate Phase 1 entirely; unrelated tech debt, not new.

## 4. Performance & scalability

**Confirmed, already-known, still-open**: public article-list pagination
defaults to offset-based (`paginate()`, which runs a `COUNT(*)` over
`articles`) unless the caller explicitly passes `?paginate=cursor`
(`app/Actions/Public/Content/ListPublicArticlesAction.php:44,209`). Cursor
mode exists and is fast, but it's opt-in, not default — any consumer
that hasn't been updated to request it still pays the COUNT cost on a
217k-row table. This predates Phase 1 and is out of Phase 1's scope, but
it's a real, live cost worth a decision before Phase 2 leans harder on
this endpoint: either flip the default, or actively migrate all known
consumers to cursor mode and deprecate the offset path.

**New from Task 14 (already reported there, repeated here for
completeness):** the `tenant_id` migration's `ALTER TABLE` on `articles`
specifically requires MySQL's `COPY` algorithm (not `INSTANT`/`INPLACE`)
because of the table's `FULLTEXT` index — measured at 177 seconds,
write-blocking, on the real dataset. Already corrected in
`PHASE1-PROGRESS.md` Task 9 with a deployment recommendation.

**Cache tag scheme (Task 7) generates correct keys but caching itself
isn't universally applied**: confirmed via reading the public list
Action that Article's list path *does* wrap its query in
`Cache::remember(...)`; did not have budget this session to verify the
same is true for Video/Reel/Broadcast/Page's equivalent public list
endpoints. This is a real gap in this audit's coverage, not a claim
that those paths are uncached — flagging it as unverified rather than
guessing either way.

**AI-readiness angle relevant here too**: zero embeddings/vector/signal-store
infrastructure exists anywhere in `app/` (confirmed via grep — zero
hits). This means Stage 4 of the evolution roadmap (Intelligence) is a
from-scratch build on the data-infrastructure side, regardless of how
good the existing `AiEditorialService` copilot layer is (see §8).

## 5. Security

**Sanitizer gap**: covered in §3 — not exploitable today, but a real
contract question worth resolving deliberately before Phase 2 adds more
content-editing surface area that reuses this sanitizer.

**IDOR / authorization on the newest surface (Task 12's entity
endpoints)**: verified directly, not assumed. `EntityController` itself
has zero inline `authorize()`/`can()` calls — all enforcement lives at
the route layer. Checked `routes/api/v1/admin.php:1136–1155`: every
route (`articles/{id}/entities`, `videos/{id}/entities`,
`reels/{id}/entities`, both GET and PATCH) carries its own correctly-scoped
`permission:{type}.edit` middleware — symmetric across all three
content types, nothing missing. `EntityManagementTest.php` only has an
explicit 403 assertion for the Article variant, not Video/Reel — a test
*coverage* gap, not an authorization gap, since the underlying
middleware is what actually enforces this, and it's uniform. Recommend
adding the missing test assertions (cheap, closes the coverage gap) but
this is not a security finding.

**Permission/metadata consistency**: already verified in Task 14 (all
28 permission groups have matching group-metadata entries, zero
mismatches) — not re-run here, cited from that work.

**Not independently re-verified this session** (budget constraint,
stated honestly rather than silently skipped): mass-assignment spot
-check across models, file-upload MIME/path-traversal handling, secrets
storage encryption-at-rest for third-party API keys, rate limiting on
public write endpoints, and CORS configuration scope. These were in the
original security-agent's mandate and did not get independently covered
once that agent's output was lost. **This is the single biggest gap in
this audit's coverage** — recommend a dedicated follow-up security pass
(the `/security-review` skill exists in this environment specifically
for this) before Phase 2, rather than treating this audit as having
cleared security.

## 6. Maintainability

Positive signals, evidenced across this whole session's work: consistent
thin Controller→Action pattern; a real, enforced model-audit convention
(every new model in Phase 1 correctly used `AuditsChanges` with a real
attribute whitelist, verified for `Entity` and `MediaAsset`); a
documented, followed ADR practice (now 16 foundational + 7
execution-level records); PHASE1-PROGRESS.md itself is a genuinely
unusual and valuable maintainability asset — most codebases don't have
a rigorous, self-correcting execution log like this one.

Negative signals: the translation-key drift (§3) and the two-workflow-
system split (Article/Video/Reel unified, Broadcast/Page not) both mean
a new contributor has to learn "it depends which content type" more
often than a fully unified system would require. Neither is wrong given
the reasons documented, but both are real ongoing cognitive load.

## 7. AI readiness

Assessed directly (not lost to the session-limit issue). The backend
already has a genuinely well-built, provider-agnostic AI layer that
predates Phase 1 and independently matches ADR-009's principles closely:

- `App\Contracts\Ai\AiProvider` — a clean `chat()`/`configured()`/`name()`
  interface, with `AiEditorialService` as the only consumer, which
  "knows" nothing about which provider is behind it.
- `FailoverAiProvider` — wraps an ordered provider chain, catches
  failures, logs a warning on fallback, throws only if every configured
  provider fails. Same resilience philosophy as `ResilientSearchable`
  (Task 10) — a real, repeated pattern in this codebase, not a one-off.
- `AiEditorialService`'s own docblock states human-in-the-loop as an
  explicit invariant: suggestions only, no auto-generation, no implicit
  save. This is ADR-009's core principle, already true in production
  before ADR-009 was ever written down.

What's genuinely absent, confirmed via grep (zero hits for
embedding/vector/signal-store anywhere in `app/`): any Signal Store, any
vector/embedding index, any persisted "Proposal" entity with an
approval state machine. Today's AI integration is entirely "suggest a
string, editor clicks apply" — there is no infrastructure yet for
classification-with-approval, related-content, or ranking (ADR-009's
fuller vision, and ADR-010).

**Verdict**: readiness for *more editorial-copilot features* is high —
the pattern is proven, just add another `AiEditorialService` method.
Readiness for the *recommendation/ranking/embeddings* vision in
ADR-009/010 is essentially zero — that's a from-scratch build for
Stage 4, not an extension of what exists.

## 8. Production readiness

Covered exhaustively in Task 14's own gate
(`docs/roadmap/PHASE1-PRODUCTION-READINESS.md`) — not repeated here.
That report already gave a clean bill of health for regressions, API
compatibility, and migration safety, with the one operational caveat
(the `articles` migration write-lock) already actioned.

---

## Challenges to Phase 1 decisions — explicit, with evidence

The user asked specifically: does anything from Phase 1 need to change
before Phase 2? Evidence-based answers:

1. **No — Task 4's Entity-vs-Tags separation (ADR-E5) holds up.**
   Nothing found in this audit weakens the reasoning; the schema is
   inert and cheap to have been wrong about if it ever needed reversal.
2. **No — Task 6's shared `EditorialWorkflowGuard` (ADR-E6) holds up.**
   Confirmed the composition-over-inheritance choice is real and load-
   bearing (Video/Reel's extra-permission divergence is genuinely data,
   not a branch).
3. **Reconsider Task 9's rollout, not the decision.** `tenant_id`
   itself is still correct per ADR-005 — but see §4/Task 14: the
   `articles`-specific migration cost was mis-stated, already corrected
   in the docs. No code change needed, only a deployment-procedure note
   (already added).
4. **Worth a deliberate decision, not urgent**: the sanitizer's
   sanitize-and-accept-silently behavior (§3). This predates Phase 1
   (P4-D1 is an older decision) but Phase 1's own content-editing work
   (entity tagging touches the same content types) makes this a live
   surface again. Recommend resolving before Phase 2 adds more content-
   authoring surface that could compound the same ambiguity.
5. **No architectural decision from Phase 1 needs reversal.** Every
   Phase 1 task was explicitly scoped as additive/non-breaking, and
   this audit (plus Task 14's regression gate) found nothing that
   contradicts that self-assessment.

## Recommended priorities before/alongside Phase 2

In rough priority order, with reasoning:

1. **Run a dedicated security pass** (§5) — the one area this audit
   could not adequately cover given the session-limit disruption.
   Highest priority precisely because it's the least-verified area, not
   because anything specific was found wrong.
2. **Decide the sanitizer contract** (§3) — cheap to fix either
   direction, but shouldn't stay ambiguous while more content-authoring
   surface gets built on top of it.
3. **Decide the pagination default** (§4) — cursor mode already exists;
   either flip the default or commit to migrating known consumers.
4. **Verify cache coverage across all 5 content types' public read
   paths** (§4) — this audit only confirmed Article's; the gap is in
   audit coverage, not a known defect, but it should be closed before
   assuming Task 7's cache-tag scheme is uniformly delivering value.
5. **Everything else** (module extraction, Projections, ContentItem) is
   already correctly sequenced in the existing Evolution Roadmap
   (`TARGET-ARCHITECTURE.md` §8) — this audit found no reason to
   reorder it.
