# Broadcast Push Notifications — AlphaCMS

Reference doc for the broadcast push-notification stub and how to
activate real delivery later. Read this before touching
`app/Support/Broadcast/BroadcastPushGateway.php` or implementing an
FCM driver.

## Current state: a stub, by design, made impossible to miss

The production review found `BroadcastPushGateway` was an honest stub —
it logged intent but never delivered a push notification to any
device, because Firebase Messaging isn't configured (the platform only
uses Firebase Storage today). The stub itself was correct; the problem
was that nothing made this state loud or checkable. This has been
fixed structurally, not by implementing real FCM (no credentials exist
to build or test that against — implementing it blind was explicitly
out of scope).

**What changed:**

1. `BroadcastPushGateway` no longer contains delivery logic itself. It
   resolves a `App\Contracts\Broadcast\BroadcastPushDriver` from the
   container and delegates to it — the same "provider-agnostic
   contract, resolved from the container" shape already proven by
   `App\Contracts\Ai\AiProvider`.
2. `App\Support\Broadcast\Push\LogBroadcastPushDriver` is the only
   driver implemented today. Every log line it writes is prefixed
   `[STUB]` — unmistakable in log output.
3. The gateway fails loudly (throws `RuntimeException`, logs at
   `error`) if push is *enabled* but the resolved driver reports
   `configured() === false`. This path is **dormant today** — the log
   driver's `configured()` always returns `true` (a log sink has no
   external credential to be missing) — it only activates once a real
   driver is selected without proper setup.
4. `App\Health\Checks\BroadcastPushHealthCheck` reports the true state
   explicitly at all times: "Push disabled", "Push stub (log only)", or
   "Push misconfigured" (failed) — registered like every other health
   check, so it's covered by the existing 15-minute `health:check`
   schedule and the existing mail/Slack alerting
   (see `docs/architecture/SEARCH-HEALTH-MONITORING.md` for how that
   infrastructure works — the same infrastructure, not a new one).

## Activating real Firebase Cloud Messaging later

This is designed to be **configuration-only** once the driver exists —
no changes to `BroadcastPushGateway`, `SendBroadcastNotificationJob`, or
any other caller.

1. Implement `App\Support\Broadcast\Push\FcmBroadcastPushDriver implements BroadcastPushDriver`:
   - `publish(string $topic, array $payload): void` — call FCM's HTTP v1
     API (`https://fcm.googleapis.com/v1/projects/{project}/messages:send`)
     with `message.topic`. Use `firebase_service_account_json` (already
     modeled and encrypted in `ThirdPartySettings`) for OAuth2 auth —
     do not add a new credential-storage mechanism, reuse the existing
     Firebase settings surface.
   - `configured(): bool` — return `true` only when
     `firebase_service_account_json` and `firebase_project_id` are
     both non-empty. This is what makes the gateway's fail-loudly guard
     meaningful once this driver exists.
   - `name(): string` — return `'fcm'`.
2. Register it in `AppServiceProvider::register()`'s
   `BroadcastPushDriver` binding (`match` on `push_driver`):
   ```php
   'fcm' => new FcmBroadcastPushDriver(app(ThirdPartySettings::class)),
   ```
3. Set `BROADCAST_PUSH_DRIVER=fcm` in the environment.

At that point: if Firebase credentials are present, push notifications
deliver for real. If they're missing, the gateway throws immediately on
every publish attempt and the health check fails — loud, not silent —
exactly the failure mode this hardening exists to guarantee.

## What did not change

`SendBroadcastNotificationJob` still injects `BroadcastPushGateway` by
type-hint with zero changes — Laravel's container resolves the driver
chain automatically. The public `publish(string $topic, array $payload)`
signature is unchanged. `broadcast.notifications.enabled` still means
what it always meant (the feature flag); `push_driver` is a new,
separate axis (which transport implements it).
