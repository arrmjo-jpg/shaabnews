# Release Notes

## Unreleased — URL migration & sitemap stability

### What changed for the site

- Article and category links across the entire public site now
  consistently use the new canonical URL format
  (`/news/dd/mm/yyyy/{id}` and `/news/category/{...}`) instead of a
  mix of old and new formats. Old-style links (`/articles/{id}`,
  `/category/{slug}`) still work — they redirect permanently (308) to
  the correct new URL, so bookmarks and external links are not broken.
- Category pages now show a breadcrumb trail (previously missing on
  this page, though present elsewhere on the site).
- The Arabic articles sitemap (`sitemap-articles-ar.xml`), which was
  failing to load at all, now generates successfully.

### What this means for SEO / search engines

- Search engines crawling the site will now consistently see the
  canonical URL format everywhere, rather than a mix of old and new
  URLs across different pages.
- The Arabic articles sitemap — previously entirely unavailable to
  search engines — is now being served correctly.
- One known item still open (tracked separately, not blocking this
  release): canonical URL tags point at the wrong domain on 4 of 7
  page types due to an environment configuration value (`SITE_URL`)
  that needs to be set correctly before the production domain goes
  live. This is a one-line configuration change, not a code change.

### What's intentionally not included in this release

- Performance tuning of sitemap generation speed for very large
  article counts (currently correct, but slow on a cache-miss — see
  the linked GitHub issue). This does not affect end users or search
  engines under normal operation, since the sitemap is cached.
- CDN purge queue worker configuration — currently CDN purging is
  disabled in this environment, so this has no live impact, but must
  be addressed before CDN is enabled in any environment (tracked
  separately).
- A handful of pre-existing operational items identified during a
  full-stack health audit (backups never having run, one stale search
  index, one missing avatar image, disabled slow-query logging) — none
  of these affect the correctness of this release; all are tracked as
  separate follow-ups.
