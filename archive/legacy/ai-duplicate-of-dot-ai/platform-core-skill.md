# AlphaCMS — Platform / Admin Core Engineering Skill

> Single source of truth for the **platform/admin core**: authentication, RBAC,
> settings, API conventions, operations/health, the AI system, the security model,
> and deployment expectations. Frontend, mobile, and backend engineers (and AI
> agents) should integrate against this without reverse-engineering code.
> Everything here reflects the **actual implementation** (verified by tests).
> News, Reels, and Video Library domains have their own skills (`ai/news-domain-skill.md`,
> `ai/reels-domain-skill.md`, `ai/video-library-domain-skill.md`); cross-cutting **content
> analytics & telemetry** (incl. the deferred advanced-telemetry roadmap) lives in
> `ai/analytics-telemetry-skill.md`. WordPress migration and public-user social features
> are out of scope (see §J — Deferred Scope).

API base: `/api/v1`. Success envelope: `{ "data": …, "meta": … }`. Error envelope:
`{ "success": false, "message": …, "errors": … }` (rendered centrally by
`ApiExceptionRenderer`). All `api/*` responses carry defensive headers
(`SecurityHeaders` middleware).

---

## A) Platform Overview

AlphaCMS is a **Laravel 11 API backend** (`app/`) with a **React admin SPA**
(`admin-frontend/`). It is an Arabic-first (RTL), bilingual (`ar`/`en`) news +
short-video platform. The admin core is the operator-facing control plane:
identity, authorization, settings, content governance, media pipeline, AI editorial
assistance, and operational visibility.

**Architectural conventions (enforced, not aspirational):**
- **Thin controllers → Actions.** Controllers validate (FormRequests) and delegate
  to single-purpose `App\Actions\…` classes that return an `ApiResponse`.
- **No business exceptions.** Actions return `ApiResponse::error(...)`; there is no
  custom-exception-for-flow-control layer. Localization is mandatory — **zero**
  hardcoded user-facing strings (everything via `lang/{ar,en}/*.php`).
- **Anti-premature-abstraction.** Prefer static helpers + direct facade calls +
  explicit invalidation over speculative service layers/wrappers.
- **Stampede-safe reads.** Hot public reads go through `CachedRead` (single-flight).
- **Granular cache invalidation** via tag helpers (`ArticleCacheTags`,
  `ReelCacheTags`), never blanket flushes on writes.
- **UI:** dashboard is modern but uses **no border-radius** anywhere (house style).

Key packages: Sanctum (token auth), Spatie Permission (RBAC), Spatie Activitylog
(audit), Spatie Settings (typed settings groups), Spatie Health, Spatie
QueryBuilder, Laravel Scout + Meilisearch (search; collection driver in tests).

---

## B) Auth Architecture

**Mechanism:** Laravel **Sanctum** personal-access tokens (Bearer). There are two
audiences distinguished by **token abilities**:
- `user` — public/account holders.
- `admin` — admin SPA. Issued only after the login Action confirms the account is
  an admin (role check happens **before** any token is minted).

**Middleware aliases** (registered in `bootstrap/app.php`):
`active` (`EnsureUserIsActive`), `recaptcha` (`VerifyRecaptcha`, gated by
`recaptcha_enabled`), `public.cache` (`PublicCacheHeaders`), `abilities` /
`ability` (Sanctum `CheckAbilities` / `CheckForAnyAbility`), `role` / `permission`
/ `role_or_permission` (Spatie).

**Route layers:**
- **Public auth** `/api/v1/auth/*` — guest: `register`, `login`, `forgot-password`,
  `reset-password` (each throttled + reCAPTCHA-gated). Authenticated:
  `auth:sanctum → abilities:user → active` for `logout`, `me`.
- **Admin auth** `/api/v1/admin/auth/*` — guest: `login`, `forgot-password`,
  `reset-password`, `email/resend`, signed `email/verify/{id}/{hash}`.
- **Admin API** `/api/v1/admin/*` — full stack:
  `auth:sanctum → abilities:admin → active → role:super_admin|editor|reviewer|moderator|social_media_manager|journalist|contributor`,
  then per-route `permission:*`.

**Password reset throttling (security-hardened):** both public
(`throttle:public.forgot-password` = 5 / 15 min / IP) and admin
(`throttle:admin.forgot-password` = 3 / 15 min / IP) cover **both**
`forgot-password` and `reset-password`. Limiters are defined in
`AppServiceProvider` (`public.login` 10/min, `public.register` 5/min, `admin.login`
5/min, `ai` per-user/min, `engagement`).

**Password reset = full session invalidation:** a successful reset (admin *and*
public `ResetPasswordAction`) **revokes ALL of the user's Sanctum tokens and rotates
`remember_token`** — recovery of a compromised account kills every existing session
immediately. Likewise, when an admin sets another user's password via the user-update
endpoint, that target's tokens are revoked and remember-token rotated. (The
self-service profile change-password keeps only the current session, revoking the
rest.)

**Password policy:** `Password::defaults()` (set in `AppServiceProvider`) enforces
**min 12 chars + mixed case + numbers + symbols**, plus `uncompromised()` (HIBP)
**in production only**. It governs the admin-sensitive flows (user create/update,
self change-password, **admin password reset**). Public register/public reset keep
their own `min:8` rule (out of admin scope).

**Email verification:** admin verify is a `signed` URL, throttled `6,1`. Resend is
throttled with the forgot-password limiter.

**Account state:** `EnsureUserIsActive` (`active`) blocks suspended/banned accounts
after authentication regardless of token validity.

**reCAPTCHA:** `VerifyRecaptcha` is a no-op unless `recaptcha_enabled`; supports v2
and v3 (score threshold + action match). Config served (no secrets) via
`GET /api/v1/recaptcha/config`.

**Self profile** (`/api/v1/admin/profile/*`) is self-scoped (no permission gate;
operates on `$request->user()`) and powers the **operator profile dashboard**:
`GET /` (identity), `PUT /` (edit name/bio/avatar/social — email is **intentionally
read-only** here, changed only by an admin via user management), `POST /password`
(change, revokes other sessions), `GET /activity` (operational timeline, filterable
by `filter[log_name|event|from|to]` — shows what the user did *and* what was done to
them), `GET /analytics` (real work metrics: articles/reels created/published/drafts,
article views generated, media uploads, AI requests/tokens/estimated-cost — all
queried live, never fabricated), `GET /permissions` (roles + effective permissions
grouped by `PermissionGroup`), `GET /security` (email-verification, last login,
password-last-changed + reset history derived from the audit log, active-session
count), `GET /sessions` + `DELETE /sessions/{id}` (revoke one) +
`POST /sessions/revoke-others` (log out all other devices, audited).

---

## C) RBAC / Permissions

Spatie Permission, **domain-grouped**, seeded by `RolesAndPermissionsSeeder` into
`PermissionGroup` entities (for an organized admin UI). Permission naming is
`domain.action` (e.g. `users.view`, `articles.publish`, `cache.clear`).

**Permission domains** include: users, roles, permissions, categories, articles,
reels, live, tags, media, settings, cdn, notifications, ads, comments, polls, seo,
analytics, **ai** (`ai.use`, `ai.settings`), and **system**
(`scheduler.view|manage|run`, `failed_jobs.view|manage`, `cache.clear`).

**Roles:** only `super_admin` and `user` are seeded as hard system roles
(`user` is required by public registration). Editorial roles
(`editor, reviewer, moderator, social_media_manager, journalist, contributor`) are
recognized at the admin route gate and managed from the panel. **`super_admin`
auto-syncs every permission** (`syncPermissions` in the seeder) — never grant it ad
hoc; add new permissions to the seeder and re-seed.

**Authorization order on a protected admin route:**
`token valid → ability=admin → account active → has an admin role → has the specific
permission`. A failure at any layer yields the standard error envelope (401/403).

---

## D) Settings System

Spatie **typed settings groups** (not Eloquent), each a `Settings` subclass:
`GeneralSettings`, `ThirdPartySettings` (group `third_party`: AI provider + keys +
models + prompts, reCAPTCHA, SMTP, etc.), CDN, and media-storage settings.

**Secret handling (mandatory):**
- Secrets are **encrypted at rest**.
- API responses **mask** secrets as `********` and expose a boolean
  `*_configured` flag (Resources: e.g. `ThirdPartySettingsResource`).
- On update, a masked/empty incoming secret means "keep the stored value" (never
  overwrites a real secret with the mask).
- **`SettingsAudit::log(group, changedKeys, secretKeys)`** records **key names
  only** — never secret values — to the activity log (`log_name=settings`).

**AI provider config, SMTP, CDN, and remote storage** are all panel-driven via
settings (not `.env`), so operators change them without redeploying. `config/ai.php`
holds only **non-secret operational** values (rate limit, Gemini base URL, cost
caps, cost-per-1k rates).

---

## E) API Conventions

- **Envelopes:** success `{ data, meta }`; error `{ success:false, message, errors }`.
  Build via `ApiResponse::success(data:, meta:)` / `ApiResponse::error(msg, errors,
  status)`. Uncaught throwables are normalized by `ApiExceptionRenderer`.
- **Validation:** FormRequests; validation failures return `422` with `errors`.
- **Pagination:** offset by default (`?per_page`, clamped to
  `config('performance.pagination.{default,max}')`); `meta.pagination`
  (`total, count, per_page, current_page, total_pages`). Public hot lists also
  support **cursor** pagination (`?paginate=cursor`, stable `published_at,id`,
  `meta.cursor`).
- **Filtering/sorting:** Spatie QueryBuilder `filter[...]` / `sort=` with explicit
  allow-lists (`AllowedFilter`, `allowedSorts`). Date-range filters are sargable on
  indexed `created_at` (no `whereDate`).
- **Locale:** public routes are `/{locale}` constrained to `ar|en`. Admin responses
  localize messages by request locale.
- **Rate limiting:** named limiters (auth, `ai`, `engagement`) + per-route
  `throttle:` on sensitive/mutating endpoints; `429` on exceed.
- **Auth:** Bearer token; ability + role + permission as in §B/§C.
- **Versioning:** path-prefixed `/api/v1`. SEO delivery (sitemaps/robots) lives at
  root, not under `/api/v1`, so crawlers find canonical locations.

---

## F) Ops / Health

Operator visibility lives under `/api/v1/admin/system/*` (gated by `scheduler.view`
for reads; mutations need stronger permissions and are throttled):

| Endpoint | Permission | Purpose |
|---|---|---|
| `GET system/health` | `scheduler.view` | Spatie Health check results (JSON) |
| `GET system/ops-overview` | `scheduler.view` | Live cheap counters: queue, failed jobs, media-sync backlog, stuck/failed transcodes, mirror health, scheduler heartbeat |
| `GET system/diagnostics` | `scheduler.view` | Admin-safe runtime snapshot (env, versions, drivers, **maintenance state**, DB/cache connectivity, cache-tagging support, queue counts, scheduler heartbeat, opcache). **No secrets.** |
| `POST system/cache/clear` | `cache.clear` (throttle 6/min) | Flush public **content** cache tags (`articles`, `articles:sitemap`, `reels`, `categories`). Audited (`log_name=system`, `event=cache_cleared`). Does **not** touch system/session/settings cache. |
| `GET\|PATCH system/scheduler[/{task}]`, `POST .../run` | `scheduler.view\|manage\|run` | Scheduled-task visibility + manage + manual run (run throttled 6/min) |
| `GET system/failed-jobs`, `POST .../retry`, `POST .../delete` | `failed_jobs.view\|manage` | Failed-job visibility + retry/delete (throttled 30/min) |
| `GET activity` | `activity.view` | System-wide audit log |

**Health checks** registered in `AppServiceProvider::configureHealthChecks()`
include `RedisProductionCheck`, `CacheTaggingCheck`, `MediaProcessingHealthCheck`,
etc. Liveness probe: `/up`.

**Maintenance mode:** enforcement is handled by Laravel's
`PreventRequestsDuringMaintenance` middleware (a down app returns `503` automatically;
`artisan down --secret=…` allows operator bypass). The admin core **surfaces**
`maintenance.down` in `system/diagnostics` for operational clarity but does **not**
expose an API toggle — toggling maintenance from the same API surface it would
disable is an operational footgun; use the CLI (`php artisan down|up`). This is a
deliberate decision, not a gap.

**Operational recovery:** content staleness → `POST system/cache/clear`; queue
backlog/failures → failed-jobs retry/delete + scheduler visibility; AI cost runaway
→ caps auto-degrade/refuse (§G); media pipeline → ops-overview stuck/failed counters.

---

## G) AI System

**Purpose:** the AI Editorial **Copilot** is *assistance, not autopilot* — it
returns suggestions a journalist reviews and applies manually. No auto-generation,
no implicit saves.

**Architecture:**
- `AiProvider` contract → `OpenAiProvider`, `GeminiProvider`, composed by
  `FailoverAiProvider` (primary from settings; falls over to the secondary on
  failure). Provider + keys + models + prompts come from `ThirdPartySettings`
  (panel-driven), **never** `.env`.
- `AiEditorialService` is provider-neutral: builds prompts, calls
  `provider->chat(messages, ['json'=>true])`, parses structured JSON
  (tolerant of code fences / surrounding chatter), sanitizes suggestion text.
- `AiCopilotController` exposes (under `permission:ai.use` + `throttle:ai`):
  `headlines`, `excerpt`, `rewrite`, `tags`, `seo`, `analyze`.

**Two operational modes:**
- **Hybrid (never breaks):** `tags`, `excerpt`, `seo` use AI when available *and*
  not capped, otherwise fall back to deterministic `EditorialHeuristics`
  (`source: "ai" | "auto"` in the response).
- **AI-only (graceful gate):** `headlines`, `rewrite`, `analyze` have no sensible
  deterministic equivalent → return `503` (`ai.not_configured` / `ai.unavailable`)
  when AI is off/unreachable, and `429` (`ai.quota_exceeded`) when a cost cap is hit.

**Cost safety / quotas (production-grade, fail-safe):**
- Caps in `config/ai.php` (`AI_*` env, **0 = unlimited**): `daily_requests`,
  `monthly_requests`, `user_daily_requests`, `monthly_budget_usd`. Estimated cost
  uses `cost_per_1k_tokens` per provider.
- `AiCostGuard::exceeded(): ?string` checks real usage (only `source=ai` rows) vs
  caps; returns a reason code (`daily_requests` / `monthly_requests` /
  `user_daily_requests` / `monthly_budget`) or `null`. Checked **before** every AI
  call. No caps configured ⇒ never blocks (fail-safe).
- On cap hit: hybrid features degrade to heuristics; AI-only features return `429`.

**Queryable usage / visibility:**
- `AiUsageLog::record(action, source, provider, inputChars, outputChars)` writes a
  monitoring log line **and** persists a queryable `ai_usages` row. **Tokens and
  cost are estimates** (`~4 chars/token`; the provider contract returns only text,
  no real token counts) — documented as estimates, not billing.
- **No sensitive content is ever stored** (no prompts, inputs, or outputs) — only
  user/provider/action/source/estimated-tokens/estimated-cost/timestamp.
- `GET /api/v1/admin/ai/usage` (`permission:ai.settings`): filterable list
  (`filter[provider|action|source|user_id|from|to]`, sortable, paginated) plus
  `meta`: today/month totals (requests/tokens/cost), breakdown by provider and by
  action, 30-day daily trend, and configured caps + remaining.

---

## H) Security Model

- **Transport/headers:** `SecurityHeaders` on all API responses.
- **Auth hardening:** ability-scoped tokens, active-account gate, role+permission
  gates, signed email-verify URLs, reCAPTCHA gating on guest auth.
- **Throttling:** all guest auth flows including **both** forgot- and
  **reset-password** (public + admin), AI per-user, sensitive ops endpoints.
- **Secrets:** encrypted at rest; masked (`********`) in responses; audit logs
  record key names only (`SettingsAudit`); AI provider keys are panel-stored.
  **Gemini API key is sent in the `x-goog-api-key` header, never the query string**
  (prevents leakage to access logs/proxies).
- **SSRF defense:** `SafeUrl::isPublicHttps()` rejects non-https and
  loopback/private/link-local/metadata hosts (`localhost`, `127.*`, `0.0.0.0`,
  `::1`, `169.254.*`, `10.*`, `192.168.*`, `172.16–31.*`, `*.local`, `*.internal`).
  Applied to: remote-storage `remote_endpoint` (validated on save **and** test —
  `UpdateMediaStorageSettingsRequest::safeEndpointRule()`), and direct-MP4 embed
  URLs (`ExternalVideoResolver::directMp4`). External video providers use a strict
  **host allow-list** (anti-domain-spoofing).
  *Note:* full SSRF protection also needs network-egress controls; this blocks the
  common literal cases and enforces https at the app layer.
- **Audit:** Spatie Activitylog for settings, system ops (cache clear), auth events,
  password-reset audit, media-usage audit. **Privilege changes** (user↔role and
  role↔permission grants/revokes) are explicitly logged via `RbacAudit` to the `rbac`
  log (actor, subject, old/new/added/removed, timestamp — names only) since pivot
  writes aren't captured by model-attribute auditing.
- **Input:** FormRequest validation everywhere; QueryBuilder allow-lists prevent
  arbitrary filter/sort injection.

---

## I) Deployment Expectations

- **PHP/Laravel 11.** Run migrations on deploy; **`db:seed --class=RolesAndPermissionsSeeder`**
  whenever permissions change (keeps `super_admin` synced).
- **Cache/queue:** **Redis required in production** (tag-capable store is mandatory —
  `CachedRead`, granular invalidation, and `system/cache/clear` all need it;
  enforced by `RedisProductionCheck`). Run a **queue worker** (media transcode/mirror,
  notifications) and the **scheduler** (`schedule:run` every minute — scheduled
  publishing, due-reels, health, etc.).
- **Settings, not env:** AI provider/keys/models, SMTP, reCAPTCHA, CDN, and remote
  storage are configured in the panel (encrypted). `.env` carries infra only
  (DB/Redis/queue/mail transport, `APP_KEY`, optional `AI_*` caps).
- **AI caps:** set `AI_DAILY_REQUEST_CAP`, `AI_MONTHLY_REQUEST_CAP`,
  `AI_USER_DAILY_REQUEST_CAP`, `AI_MONTHLY_BUDGET_USD`, and
  `AI_COST_{OPENAI,GEMINI}_PER_1K` to taste (0 = unlimited).
- **Search:** Meilisearch via Scout in production; tests use the `collection` driver.
- **Health/liveness:** `/up`; operational dashboards via `system/*` (§F).
- **Maintenance:** `php artisan down --secret=…` / `up` (status visible in
  `system/diagnostics`).

---

## J) Deferred Scope (explicitly NOT in admin core)

These are intentionally **out of the admin-core closure** and tracked separately:
- **Public-user social/engagement product features** beyond the existing polymorphic
  engagement primitives (reactions/favorites/views) and comments moderation.
- **WordPress migration** tooling.
- **Meilisearch-backed** advanced public search for some surfaces (current basic
  search is DB `LIKE`; Scout wiring exists).
- **Admin SPA pages** for the newly added backend endpoints (`/admin/ai/usage`,
  `/admin/system/diagnostics`, `/admin/system/cache/clear`) — the **APIs are closed
  and tested**; building/refining their React UIs is frontend follow-up.
- **Network-level SSRF egress controls** (app-layer `SafeUrl` guard is in place; a
  hardened production network policy is an infra concern).
- Real (non-estimated) AI token accounting — blocked by provider contracts that
  return text only; revisit if/when providers expose usage in responses.
- **Advanced content telemetry & analytics** — video **watch metrics** (starts / avg-watch /
  completion / drop-off / milestones), **true historical unique viewers**, **notification
  delivery & conversion** analytics, **advanced traffic attribution** (campaign / source-domain /
  newsletter / app / push), and **per-session broadcast telemetry** (join / leave / rejoin /
  churn). The per-entity analytics surfaces + forward-only rollups are **implemented and tested**;
  the advanced layer is a **dedicated future phase** requiring new telemetry ingestion — see
  `ai/analytics-telemetry-skill.md` (§B–§C).

---

*This document reflects the implemented platform/admin core and is kept in sync with
tests. If code and this skill disagree, the code (and its tests) win — fix the doc.*
