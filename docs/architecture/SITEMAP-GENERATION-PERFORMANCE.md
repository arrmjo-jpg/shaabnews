# Sitemap Generation Performance — AlphaCMS

Reference doc for the `sitemap-articles-{locale}.xml` investigation
(2026-07-18). Read this before touching `SitemapController::articles()`
or upgrading `spatie/laravel-sitemap`.

## Why this exists

A production health audit found `sitemap-articles-ar.xml` hanging
indefinitely (30s+ timeout, nginx 499) while every other sitemap
endpoint returned 200. Root-caused and fixed in two stages, both now
merged. A third bottleneck was found during verification and is
**not** fixed — it's the subject of this doc and the linked ticket.

## What was fixed (closed — this is the correctness ticket)

**1. Wrong MySQL index chosen by the optimizer.**
`EXPLAIN` showed MySQL picking `articles_locale_slug_unique` (irrelevant
to this query) over `articles_status_locale_pub_idx` (built for exactly
this filter+sort shape), forcing a full filesort over ~26k–30k
candidate rows. `ANALYZE TABLE articles` did not change the optimizer's
choice (measured before/after — same plan, same ~33–37s). Fixed with a
query-level hint in `SitemapController::articles()`:

```php
Article::query()
    ->from(DB::raw('`articles` USE INDEX (articles_status_locale_pub_idx)'))
    ->published()
    ->forLocale($locale)
    ...
```

`USE INDEX` (a suggestion) was used instead of `FORCE INDEX` (mandatory)
deliberately — it keeps MySQL's optimizer as a fallback if the data
distribution changes enough in the future that this index stops being
the right choice, rather than hard-locking one plan forever.

Measured: 5,000 rows 32.6s → 1.66s; 20,000 rows 41.0s → 5.75s.

**2. `SELECT *` + an unused eager load, at 50,000-row scale.**
The query loaded every column (including large text fields never
touched by this method) plus eager-loaded `primaryCategory:id,slug` —
which this method never actually reads (verified: neither
`$article->primaryCategory` nor `$sib->primaryCategory` appears
anywhere in `articles()`). At the full `ARTICLES_PER_SITEMAP = 50000`
cap this pushed peak memory to 847MB, exceeding the 512M `memory_limit`
and turning the (now-fast) query into a fatal 500. Fixed by selecting
only the columns the loop actually reads and dropping the dead eager
load:

```php
->select(['id', 'locale', 'published_at', 'created_at', 'updated_at', 'translation_group'])
```

Measured: 20,000 rows 402.5MB → 102.5MB; 50,000 rows 847MB (over limit,
500) → 182.5MB (well within limit, 200 OK).

Both fixes are scoped to `SitemapController::articles()` only — verified
via `git diff --stat` that no other query in the codebase was touched,
and confirmed the other 6 sitemap sub-endpoints (`categories`, `news`,
`reels`, `videos`, `video-categories`, `playlists`, `team`) still
return 200 unaffected.

## What's still open — see the linked ticket

With both fixes applied, `sitemap-articles-ar.xml` returns 200 with
valid XML (50,000 well-formed `<url>` entries, verified via
`DOMDocument`), but a full cache-miss regeneration still takes
**~62–70 seconds**. Stage-by-stage profiling (standalone instrumented
script, not tinker, to get clean timings) at 50,000 rows:

| Stage | Time | % of total |
|---|---|---|
| Query execution | 5.6s | 9.1% |
| Model hydration | 1.1s | 1.8% |
| `Url::create()` | 2.8s | 4.5% |
| `addAlternate()` | 0.07s | 0.1% |
| **`Sitemap::add()`** | **41.8s** | **67.1%** |
| `Sitemap::render()` | 10.8s | 17.4% |

`addAlternate()` is near-zero because `translation_group` is `null`
for every article in this dataset today — worth re-measuring if that
ever changes.

**Root cause of the `Sitemap::add()` cost**, from reading
`vendor/spatie/laravel-sitemap/src/Sitemap.php`:

```php
public function add(string|Url|Sitemapable|iterable $tag): static
{
    ...
    if (! in_array($tag, $this->tags)) {
        $this->tags[] = $tag;
    }
    return $this;
}
```

Every `add()` call does a full linear, object-comparison scan of
everything added so far to de-duplicate. Called once per URL for
50,000 URLs, this is O(n²) — the 50,000th call scans ~50,000 existing
entries. This is a library characteristic exposed at this data volume,
not a bug in this codebase's usage of it.

**This does not block correctness.** The `Cache::tags(...)->remember()`
wrapper around this method means the ~62–70s cost is paid only on a
genuine cache miss (TTL expiry or tag invalidation) — a second request
immediately after a fresh generation returned in 0.48s, confirming
caching works as designed. The risk is narrow: whichever single
request (potentially a real search-engine crawler) triggers a
regeneration could experience a long hang or its own client-side
timeout.

Follow-on scope (not started — see linked issue):
- Check whether a newer `spatie/laravel-sitemap` release changed
  `add()`'s de-duplication strategy (e.g., a hash-keyed set instead of
  `in_array` over an array).
- Evaluate whether `Sitemap::add()` can be bypassed — e.g. building the
  `Url[]` array directly and rendering without going through `add()`'s
  per-item check, if de-duplication isn't actually needed here (article
  IDs are already unique by construction).
- Evaluate a streaming/direct-XML-writer approach if the URL count
  keeps growing and library-level fixes aren't sufficient.

Do not jump straight to any of the above without re-measuring first —
that's exactly the discipline that kept this investigation from
rewriting working code based on a guess.

## Related

- GitHub issue: (linked below once created)
- `docs/architecture/CACHE-INVALIDATION.md` — the tag/ISR system this
  cache wrapper participates in.
