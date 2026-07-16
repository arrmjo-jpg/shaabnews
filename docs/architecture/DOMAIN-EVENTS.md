# Domain Events — AlphaCMS

Reference doc for how the event system works and why it's shaped this
way. Read this before adding a new domain event or listener.

## Why this exists
Before Phase 1 Task 5, side-effects of publishing (cache invalidation,
CDN purge, writer notification) were called imperatively, inline, inside
the Action that performed the write. Adding a new consumer (search
indexing, AI tagging, a future read-model rebuild) meant editing the
publish path itself. `ArticleStatusChanged` is the first domain event in
the platform, introduced to decouple that — see
`docs/adr/E2-domain-events-wrap-not-replace.md` for the decision record.

## Current event catalogue

### `App\Events\Content\ArticleStatusChanged`
Dispatched by `TransitionArticleStatusAction`, once, immediately after a
successful commit (never on a rolled-back transition — see below).

```
payload: { article: Article, from: ArticleStatus, to: ArticleStatus, actor: User }
```

**Listener chain** (registered in this exact order —
`AppServiceProvider::configureContentEvents()`):

1. `App\Support\Content\Listeners\InvalidateArticleCacheOnStatusChanged`
   — `Cache::tags(ArticleCacheTags::writeTags($article))->flush()`
2. `App\Support\Content\Listeners\PurgeArticleCdnOnStatusChanged` —
   `ArticleCdnPurge::purge($article)`
3. `App\Support\Content\Listeners\NotifyWriterOnArticleStatusChanged` —
   `WriterNotifier::contentStatusChanged($article, 'article', $to->value)`

Each listener is a one-line wrapper around the exact call that used to
live inline in the Action — this was a refactor, not a redesign.

## Event flow

```
TransitionArticleStatusAction::handle()
  → ArticleWorkflowGuard::check()   (may return early — deny, no transaction, no event)
  → DB::transaction(status change + save + revision snapshot)
      (any exception here rolls back AND prevents the event() call below
       from ever being reached — this is plain PHP control flow, not a
       feature specific to this event; the same guarantee already
       applied to the inline calls it replaced)
  → event(new ArticleStatusChanged(...))
      → Listener 1 (cache)
      → Listener 2 (CDN)
      → Listener 3 (notify)
  → response returned
```

## Why listeners are synchronous, not queued
The response today does not return until cache invalidation, CDN purge,
and the writer notification have all completed — that was true before
this event existed, and it still is. Converting these listeners to
queued (`ShouldQueue`) would change that observable behavior (the
response would return before the side-effects finish) — that's a
legitimate future optimization, but it is a **separate architectural
decision** requiring its own evidence (queue depth, worker capacity,
whether callers depend on read-after-write consistency), not something
to fold silently into an event-wrapping refactor.

## Registration convention — and why listeners must NOT live in `app/Listeners`

Register every listener explicitly in `AppServiceProvider`, in a
`configureXEvents()` private method called from `boot()`, e.g.:

```php
Event::listen(ArticleStatusChanged::class, InvalidateArticleCacheOnStatusChanged::class);
```

**Listener classes must live under a domain namespace
(`App\Support\Content\Listeners`, matching
`App\Modules\Notifications\Listeners`) — never under the literal
`app/Listeners` directory.**

### Why: the regression this convention exists to prevent
During Task 5, the three listeners were first placed at
`app/Listeners/Content/*.php`. The first test run showed the writer
notified **twice** for one transition. `php artisan event:list` showed
each listener registered twice: once by Laravel 11's automatic event
discovery (which scans `app/Listeners` for any class with a `handle()`
method type-hinted to an event — no opt-in required) and once by the
explicit `Event::listen()` call already present in
`AppServiceProvider`. Both registrations fired on every dispatch.

The fix was to relocate the listeners outside the auto-scanned
directory (`App\Support\Content\Listeners`), matching the
`Notifications` module's existing pattern — which turns out to exist
for exactly this reason, whether or not that was the original intent.

**If you add a new listener in this project, do not put it in
`app/Listeners`.** Put it in the relevant domain's `Support\Listeners`
namespace and register it explicitly. Verify with
`php artisan event:list` that it appears exactly once before trusting
any test result.

## What's next
Task 6 (Phase 1 roadmap) extends this pattern to Video and Reel, which
already have their own `Transition{Video,Reel}StatusAction` +
`{Video,Reel}WorkflowGuard` pairs (independently evolved, not copied
from this event work) — see the Task 6 design review in
`docs/roadmap/PHASE1-PROGRESS.md` for what's actually shared vs.
type-specific before any code changes there.
