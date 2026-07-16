# Next.js Caching Gotchas — Developer Guide

Real, discovered-in-this-project traps in Next.js 15's caching model that
are easy to misread from the source code alone. Read this before changing
any `revalidate` value or debugging "why is this page updating faster/
slower than I set it to."

---

## 1. `export const revalidate = N` on a page is NOT the real ISR interval

**The trap**: a page file declares, e.g.:

```ts
// app/(site)/page.tsx
export const revalidate = 3600; // looks like: "this page updates once an hour"
```

A developer reading this reasonably assumes the homepage regenerates
hourly. **This is wrong**, and the gap isn't small.

**The actual rule**: Next.js computes the *effective* revalidate window for
a statically-rendered page as the **minimum** of:
- the page's own `export const revalidate`, and
- the `next: { revalidate }` value of **every single `fetch()` call**
  anywhere in that page's render tree — including every nested Server
  Component, every section, every child fetch, no matter how deep.

The page-level export is a *ceiling*, not the actual interval. One `fetch`
buried in a rarely-noticed subcomponent with a short `revalidate` silently
overrides the number at the top of the file — no warning, no error, no
lint rule catches it.

**Confirmed real example from this project** (measured directly, not
theoretical): the homepage declares `revalidate = 3600` in
`app/(site)/page.tsx`. A clean production build (`next build`) reports its
*actual* effective revalidate as **`1m`** (60 seconds) — because at least
one of the ~18 independently-fetching sections rendered on that page uses a
60-second `next.revalidate` somewhere in its own data call. See
`docs/roadmap/baselines/next-build-output.txt` (Sprint 0 baseline) for the
literal build table showing this.

**How to check the real number for any page**: run a production build and
read its own report — don't trust the source file:

```bash
npm run build
# then look at the "Revalidate" column in the Route (app) table
# for the specific route you care about
```

If you need a page to genuinely honor a longer window, every `fetch()` in
its entire render tree needs to agree on that window (or a longer one) —
changing the page-level export alone does nothing if a child fetch
disagrees.

---

## 2. Always measure Cold AND Warm — never just one

**The trap**: measuring a page once and reporting that number as "the"
response time. Every timing number has an implicit cache state attached to
it, and reporting only the warm number overstates real-world performance.

**Concrete example from this project**: an early performance pass reported
the homepage at **8–14ms**. That number is real, but it's the response
time *after ISR/Data Cache is already warm* — the case for most visitors
most of the time, but not the case right after a deploy, right after a
revalidate window expires, or for a page that isn't requested often enough
to stay warm. Reporting only the warm number without saying so reads as
more impressive than it is, and hides regressions that only show up on a
cache miss.

**The other direction matters too**: `/sport/team/1` measured **405ms on
the first request, 51ms on the second** (`docs/roadmap/FRONTEND-RUNTIME-
AUDIT.md`, section 1). Only measuring the second request would have missed
an 8x gap entirely — in that specific case the gap was itself the evidence
of a real bug (a duplicate fetch, fixed in IMPLEMENTATION-ROADMAP.md item
3.7), not just cache physics.

**Standing practice going forward**: when reporting a page's response
time or including it in a performance comparison,
1. State which cache state the number reflects (cold: first request after
   a deploy/restart or after the revalidate window has expired; warm:
   cache already populated).
2. Where practical, measure both and report both — a single number without
   its cache state is not a complete answer to "how fast is this page."
3. A large cold/warm gap is itself a signal worth investigating (could be
   a genuine N+1/duplicate-fetch bug, not just expected cache physics) -
   don't dismiss it as "expected" without checking.

## 3. Practical implications

- **Don't infer freshness from the page file.** If you're debugging "why
  did this content update sooner than I expected," check the build's own
  report first, then audit every fetch in the tree — not just the page's
  top-level export.
- **When composing a page from many independently-fetching sections**
  (common on this project's homepage-style pages), the effective
  revalidate is only ever as long as the *shortest* section's fetch. Adding
  one more section with an aggressive revalidate value silently shortens
  the whole page's effective cache window.
- **This is a build-time-visible fact, not a runtime mystery** — always
  reproducible by running `next build` and reading its table. Don't guess;
  check.
