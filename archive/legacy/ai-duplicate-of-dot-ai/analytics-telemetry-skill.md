# AlphaCMS — Analytics & Telemetry Engineering Skill

> Cross-cutting source of truth for **content analytics & telemetry** across the
> **Video Library** and **Broadcast** domains. Everything in §A reflects the **actual
> implementation** (verified by the Pest suite). §B is the **deferred roadmap** —
> intentionally not built yet, documented so it is not forgotten or accidentally faked.
>
> Sibling skills: `ai/platform-core-skill.md`, `ai/video-library-domain-skill.md`,
> `ai/news-domain-skill.md`, `ai/reels-domain-skill.md`. **The Broadcast domain has no
> standalone skill doc yet**, so its analytics surface and deferrals are documented here.
>
> **CRITICAL discipline:** keep the line between **CURRENTLY IMPLEMENTED** (§A) and
> **DEFERRED / FUTURE** (§B) unambiguous. Deferred metrics are surfaced in the UI as an
> explicit "not tracked yet" state — **never** as zeros disguised as real data. Do not
> promise a §B metric as if it exists.

---

## A) Currently Implemented (baseline — real data only)

### A.1 Per-entity analytics surfaces

| Surface | Endpoint | Permission |
|---|---|---|
| Video analytics | `GET /api/v1/admin/videos/{video}/analytics` | `videos.view` |
| Broadcast analytics | `GET /api/v1/admin/broadcasts/{broadcast}/analytics` | `broadcasts.view` |

- **Range filter:** `range = 24h \| 7d \| 30d \| custom` (custom takes `from`/`to`).
  Resolved by `App\Support\Analytics\AnalyticsRange` (clamped, max ~366 days).
  **Granularity is daily** (no hourly / sub-day buckets).
- **Pattern:** thin controller → `*EntityAnalyticsAction` → `Cache::remember` (short TTL).
  For broadcast, **"current viewers" is read live** (`BroadcastPresence::count`) **outside**
  the cache; the heavy DB aggregates are cached.
- **SPA:** `/video-library/videos/:id/analytics`, `/broadcast/broadcasts/:id/analytics`
  (reached from each list row's *Analytics* action). Charts are **dependency-free**
  (SVG/flex bars in `components/analytics/AnalyticsKit.tsx`) — **no chart library**, **no
  border-radius** (house style). KPI cards/panels reuse the per-feature `StatPrimitives`.

### A.2 Forward-only telemetry foundation

Added in the *Detailed Analytics* phase. **Forward-only: there is NO historical backfill —
data accrues from deploy onward.** All write-points are existing schedulers / batched paths
(no new ingestion service):

| Store | Written by | Powers |
|---|---|---|
| **`content_daily_stats`** (polymorphic: `engageable_type/id`, `day`, `views`, signed `likes/dislikes/favorites` deltas, per-channel `views_{direct,internal,search,social,referral}`) | `ViewBuffer::flush()` (batched, off the hot path) + `EngagementService` reaction paths | views & engagement **over time**, traffic-source split (any engageable: video, broadcast, article, reel) |
| **`broadcast_viewer_samples`** (`broadcast_id`, `viewers`, `sampled_at`) + **`broadcasts.peak_viewer_count`** | `SyncBroadcastViewerCountsAction` (everyMinute; rolling retention `broadcast.analytics.sample_retention_days`, default 30) | **peak / average concurrent**, concurrency curve |
| **`TrafficChannel`** enum — `direct, internal, search, social, referral` | classified at the **view beacon** from `Referer` / UTM (`TrafficChannel::fromRequest`) | coarse traffic attribution |

Properties to remember:
- **Daily rollup rides the view-buffer flush.** If the Redis view buffer is disabled, the
  synchronous fallback still increments the cumulative counter but does **not** write the
  daily rollup (forward-only telemetry follows the buffer).
- **Reaction deltas** are net per-day (can be negative on toggle-off).
- **Broadcast samples** only exist while a broadcast is **live** (per-minute), within the
  rolling retention window; **all-time peak** persists permanently on the column.

### A.3 What is measurable NOW (honest)

**Video:** cumulative `views/likes/dislikes/favorites` + engagement rate + **unique reactors**
(current-snapshot `COUNT(DISTINCT actor_key)`); views & engagement **over time** (forward-only);
coarse **traffic channels**; distribution (featured / category / playlists / linked VODs);
slug + **redirect history**; **publish timeline** (reconstructed from the audit log).
→ **Watch metrics: NOT tracked** (see §B.1).

**Broadcast:** **current / peak / average concurrent** + concurrency curve; likes/dislikes;
**lifecycle** (scheduled / started / ended, start-delay, duration); **health** (failure /
recovery counts, latency summary, recent events); **moderation** (kicks / bans / closures /
emergency-shutdowns + recent events, from the durable audit log); reminder subscribers +
go-live / reminder **dispatch markers**.
→ **Unique viewers: NOT tracked** (presence is approximate/ephemeral — §B.2).
→ **Notification delivery / conversion: NOT tracked** (FCM is a log stub — §B.3).

---

## B) Deferred / Future — Advanced Telemetry & Analytics (dedicated phase)

> These are **intentionally deferred, not forgotten.** Each requires telemetry that does
> **not** exist today. See §C for phase discipline.

### B.1 Video Watch Telemetry

**Deferred capabilities:** video starts · average watch time · completion rate ·
drop-off analytics / retention curve · playback milestones (25% / 50% / 75% / 100%).

**Architectural notes — requires dedicated player-telemetry ingestion:**
`frontend player beacon events → backend ingestion endpoint → aggregation pipeline →
retention storage` (forward-only rollup table + TTL'd raw events). High-volume; must be
queued/buffered like the existing view path.

**Explicit:** the platform **does NOT track these metrics today.** The only viewer signal a
video has is a single binary, per-actor-deduped **view** increment — there is no playback
progress / heartbeat / watch-session anywhere.

### B.2 True Unique Viewers

**Deferred capabilities:** historical **unique viewers per video** · historical **unique
viewers per broadcast** · better identity dedup strategies.

**Architectural notes:** the current presence model is **approximate and ephemeral**
(bucketed Redis counters, TTL'd). Current analytics can estimate **concurrency**, **not**
durable exact unique viewers. Potential future approaches: privacy-conscious dedup identity,
hashed stable identifiers, time-window uniqueness models (e.g. a daily HyperLogLog per entity).

**Explicit:** current numbers are **approximate where applicable.** "Unique reactors" (video)
is a current-snapshot distinct-actor count — **not** a historical unique-viewer series.
Broadcast unique viewers are **not** derivable from concurrency samples.

### B.3 Notification Effectiveness Analytics

**Deferred capabilities:** notification sends · delivery success · opens · reminder
conversion · "came from notification" attribution.

**Architectural notes — requires real FCM/APNs integration and delivery-receipt tracking**
(per-message / per-token receipts), plus an attribution link between a dispatched
notification and a subsequent view.

**Explicit:** the notification infrastructure is **architecture-ready** (topic fan-out,
subscriptions, anti-flap fire-once markers) **but delivery analytics are unavailable** —
FCM is a **log stub** (not provisioned) and the topic-broadcast model captures **no per-user
receipts**. Only **intent** (subscriber counts) and **dispatch markers** (`live_notified_at`,
`reminder_dispatched_at`) are real today.

### B.4 Advanced Traffic Attribution

**Current (coarse) channels:** `direct · internal · search · social · referral`
(derived from `Referer` / UTM at the view beacon; forward-only; only the 5 bucketed
counters are persisted — raw referrer host and the full UTM tuple are **not** stored).

**Future expansion:** campaign drilldowns · source-domain analytics · newsletter
attribution · app attribution · push attribution · richer UTM reporting
(full medium / source / campaign breakdown, with the attribution dimensions stored/rolled up).

### B.5 Advanced Broadcast Telemetry

**Deferred capabilities:** join rate · leave rate · audience retention curve ·
rejoin analysis · session duration · churn metrics.

**Architectural notes — requires richer presence/session telemetry** (per-session
join/leave/rejoin events). The current system is **intentionally optimized for scalable
APPROXIMATE concurrency** (bucketed counters at ~100k peak), not per-session tracking.

**Explicit:** today only **minute-sampled concurrency** (peak / average / curve) exists.
There are **no** join / leave / session / rejoin events.

---

## C) Phase discipline (Watch Telemetry phase notes)

- Advanced watch / session telemetry (§B.1, §B.5) **MUST be its own dedicated phase.** It
  introduces a **new telemetry ingestion architecture** (high-volume client beacon → queue →
  aggregation → retention storage), **not** a small add-on to an unrelated feature.
- **Do NOT mix it casually into unrelated work.** Scoping it inside another phase will either
  bloat that phase or produce a half-built ingestion path.
- **Build order when greenlit:** signed player/session beacon endpoint → queued aggregation →
  forward-only rollup tables → per-entity surfaces → honest empty-states until data accrues.
- **Reuse the established discipline:** the forward-only rollup pattern
  (`content_daily_stats` / `broadcast_viewer_samples`), batched write-points off the hot path,
  and **no fabricated data** — deferred metrics render an explicit "not tracked" notice.

---

## D) Cross-references

- **Current per-entity analytics** live alongside their domains: Video Library skill §I
  (`ai/video-library-domain-skill.md`); the Broadcast domain has **no standalone skill** yet,
  so its analytics + deferrals are documented here.
- **Telemetry write-points:** `App\Support\Engagement\{ViewBuffer,EngagementService,DailyEngagementRollup}`,
  `App\Enums\TrafficChannel`, `App\Actions\Admin\Broadcast\SyncBroadcastViewerCountsAction`.
- **Readers:** `App\Support\Analytics\{AnalyticsRange,DailyEngagementReader}`,
  `App\Actions\Admin\VideoLibrary\VideoEntityAnalyticsAction`,
  `App\Actions\Admin\Broadcast\BroadcastEntityAnalyticsAction`.
- **Deferred-scope index:** `ai/platform-core-skill.md` §J references this roadmap.

---

*This document reflects the implemented analytics/telemetry surface and the explicitly
deferred roadmap. If code and this skill disagree, the code (and its tests) win — fix the doc.*
