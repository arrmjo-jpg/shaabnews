# Changelog

All notable changes to this project are documented in this file.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed

- **Legacy URL rendering across the frontend.** Every page/component that
  built article or category links now uses the canonical URL builders
  (`canonicalArticlePath()`, `categoryHref()`) instead of relaying
  backend `canonical_path` data or hardcoding `/category/{slug}` /
  `/articles/{id}` strings. Affected: homepage, category pages, header
  nav, footer, search results, related-articles, article share URL and
  breadcrumb JSON-LD, activity/saved feed. Verified: 0 legacy URLs in
  rendered HTML across homepage/category/article/search; legacy
  redirect routes (`/articles/{id}`, `/category/{slug}`) still 308 to
  the correct canonical target.
- **`CategoryBreadcrumb` not rendered on the category page.** The
  component was computed (`const breadcrumb = <CategoryBreadcrumb .../>`)
  but never inserted into the page's JSX. Now renders both the visible
  breadcrumb nav and its `BreadcrumbList` JSON-LD.
- **`sitemap-articles-ar.xml` hanging indefinitely (nginx 499 / 500).**
  Two independent, sequential bottlenecks identified and fixed in
  `SitemapController::articles()`:
  - MySQL's optimizer was choosing an irrelevant index
    (`articles_locale_slug_unique`) over the index built for this exact
    query (`articles_status_locale_pub_idx`), forcing a filesort over
    tens of thousands of rows. Fixed with a `USE INDEX` hint (not
    `FORCE INDEX`, to keep the optimizer's fallback if data
    distribution changes). `ANALYZE TABLE` alone did not fix this —
    verified before/after.
  - `SELECT *` plus an unused `primaryCategory` eager load pushed peak
    memory to 847MB at the full 50,000-row cap, exceeding the 512M
    `memory_limit` and causing a 500. Fixed by selecting only the
    columns the method actually reads and removing the dead eager
    load.
  - See `docs/architecture/SITEMAP-GENERATION-PERFORMANCE.md` for full
    measurements and the follow-on performance ticket for the
    remaining `Sitemap::add()` O(n²) cost (not a correctness issue —
    see Known Limitations below).

### Notes

- Backend query/controller changes are scoped strictly to
  `SitemapController::articles()` — verified via `git diff --stat`
  that no other query in the codebase was touched, and the other 6
  sitemap sub-endpoints still return 200 unaffected.
