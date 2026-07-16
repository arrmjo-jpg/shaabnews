# Search Index Health Monitoring — AlphaCMS

Reference doc for how Meilisearch index-drift detection works and how
to recover from it. Read this before touching
`app/Health/Checks/ContentSearchHealthCheck.php` or adding a sixth
searchable content type.

## Why this exists

The backend production review found that `ResilientSearchable`
(Task 10) correctly prevents a Meilisearch outage from breaking the
write path — an article still saves even if the search engine is
unreachable — but nothing was watching for the resulting **silent
index drift**. Only `Epaper` had a dedicated search health check
(`EpaperSearchHealthCheck`); Article, Video, Reel, and Broadcast did
not. This closes that gap uniformly.

## How it works

`App\Health\Checks\ContentSearchHealthCheck` is a shared, abstract
engine — the same "generic engine + per-type data" shape as
`CacheTagScheme` (Task 7) and `EditorialWorkflowGuard` (Task 6). Each
content type supplies three things via a thin subclass:

```php
class ArticleSearchHealthCheck extends ContentSearchHealthCheck
{
    protected function indexName(): string { return 'articles_index'; }
    protected function expectedSearchableCount(): int { return Article::query()->count(); }
    protected function recoveryCommandHint(): string { return 'php artisan search:reindex article --fresh'; }
}
```

`expectedSearchableCount()` must mirror that model's actual
`shouldBeSearchable()` predicate — these are **not** uniform. Article
indexes every non-deleted row (filtering happens at query time, not
index time); Video/Reel/Broadcast only index published/public rows.
Get this wrong and the check will report false drift.

### Status logic (`evaluateDrift()`)

1. Scout driver isn't `meilisearch` → **ok** (reading straight from the
   database, no index to monitor — this is the normal state in local
   dev and any environment without Meilisearch configured).
2. Meilisearch unreachable → **failed** immediately.
3. Otherwise, compare indexed document count to `expectedSearchableCount()`:
   - Expected > 0 but indexed = 0 → **failed** (index lost or never built).
   - Drift ≥ `performance.search.health_failure_drift_percent` (default 30%) → **failed**.
   - Drift ≥ `performance.search.health_warning_drift_percent` (default 10%) → **warning**.
   - Otherwise → **ok**.

Both thresholds are configurable via `SEARCH_HEALTH_WARNING_DRIFT_PERCENT`
/ `SEARCH_HEALTH_FAILURE_DRIFT_PERCENT`.

## Scheduling, alerting, and metrics — already handled, not reinvented

These checks are registered in
`AppServiceProvider::configureHealthChecks()` alongside every other
check. **No new scheduling, alerting, or metrics infrastructure was
built** — `spatie/laravel-health` already provides all three for any
registered check:

- **Scheduled**: `health:check` runs every 15 minutes
  (`routes/console.php`), covering all registered checks automatically.
- **Alerts**: `config/health.php` has notifications enabled (mail,
  optionally Slack), throttled to one per hour, firing on `warning` or
  `failed` (`only_on_failure: false`). A new check needs no per-check
  alert wiring — registering it is enough.
- **Metrics**: each check's `Result::meta()` payload (index name,
  indexed/expected counts, drift percentage) is persisted via
  `EloquentHealthResultStore` and visible through Spatie Health's
  existing result history — the same place every other check's data
  already lives.

## Recovery

`php artisan search:reindex {article|video|reel|broadcast} [--fresh] [--queue]`

A thin wrapper around Laravel Scout's own `scout:import` /
`scout:queue-import` — it does not reimplement sync logic, only maps a
friendly type name to the model class. `--fresh` flushes the index
before reimporting (passed straight through to `scout:import`, or
implemented as a manual `scout:flush` + `scout:queue-import` when
combined with `--queue`, since Scout's queued-import command doesn't
support `--fresh` natively).

Epaper is deliberately **not** covered by this command — it doesn't use
Scout's `Searchable` trait (it has its own `EpaperSearchIndexer` and
`epaper:search-reindex` command), so a shared wrapper doesn't apply to
it without forcing an artificial common interface onto two genuinely
different indexing mechanisms.

## Adding a sixth searchable type

1. Give the model `ResilientSearchable` (see `Video`/`Reel`/`Broadcast`
   for the pattern) with a correct `shouldBeSearchable()`.
2. Add a `{Type}SearchHealthCheck extends ContentSearchHealthCheck`
   with the three required methods above — `expectedSearchableCount()`
   must match `shouldBeSearchable()` exactly.
3. Register it in `AppServiceProvider::configureHealthChecks()`.
4. Add the model to `ReindexSearchCommand::MODELS`.
5. Write a test mirroring `ContentSearchHealthCheckTest.php`'s
   `publicExpectedCount()` cases for the new type — this is the part
   most likely to have a bug (a wrong enum comparison or column name).
