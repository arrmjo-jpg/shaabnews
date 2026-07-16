<?php

declare(strict_types=1);

use App\Contracts\Broadcast\BroadcastPushDriver;
use App\Health\Checks\BroadcastPushHealthCheck;
use App\Support\Broadcast\BroadcastPushGateway;
use App\Support\Broadcast\Push\LogBroadcastPushDriver;

// ─── LogBroadcastPushDriver — the stub itself ──────────────────────────────

it('the log driver is always configured and never throws', function (): void {
    $driver = new LogBroadcastPushDriver;

    expect($driver->configured())->toBeTrue()
        ->and($driver->name())->toBe('log');

    $driver->publish('broadcasts-live', ['broadcast_id' => 1]); // لا استثناء
});

// ─── BroadcastPushGateway — the fail-loudly guard ──────────────────────────

it('does not call the driver at all when push notifications are disabled', function (): void {
    config(['broadcast.notifications.enabled' => false]);
    $driver = Mockery::mock(BroadcastPushDriver::class);
    $driver->shouldNotReceive('publish');
    $driver->shouldNotReceive('configured');

    (new BroadcastPushGateway($driver))->publish('topic', []);
});

it('delegates to the driver when enabled and configured', function (): void {
    config(['broadcast.notifications.enabled' => true]);
    $driver = Mockery::mock(BroadcastPushDriver::class);
    $driver->shouldReceive('configured')->once()->andReturn(true);
    $driver->shouldReceive('publish')->once()->with('topic', ['x' => 1]);

    (new BroadcastPushGateway($driver))->publish('topic', ['x' => 1]);
});

it('fails loudly instead of silently when enabled but the driver is not configured', function (): void {
    config(['broadcast.notifications.enabled' => true]);
    $driver = Mockery::mock(BroadcastPushDriver::class);
    $driver->shouldReceive('configured')->once()->andReturn(false);
    $driver->shouldReceive('name')->andReturn('fcm');
    $driver->shouldNotReceive('publish');

    (new BroadcastPushGateway($driver))->publish('topic', []);
})->throws(RuntimeException::class);

// ─── Driver resolution — unknown driver name fails at resolution, not silently ──

it('throws immediately when an unknown push driver is configured', function (): void {
    config(['broadcast.notifications.push_driver' => 'not-a-real-driver']);

    app(BroadcastPushDriver::class);
})->throws(RuntimeException::class);

it('resolves the log driver by default', function (): void {
    config(['broadcast.notifications.push_driver' => 'log']);

    expect(app(BroadcastPushDriver::class))->toBeInstanceOf(LogBroadcastPushDriver::class);
});

// ─── BroadcastPushHealthCheck — makes the stub state impossible to miss ────

it('health check reports OK with a clear disabled message when push is off', function (): void {
    config(['broadcast.notifications.enabled' => false]);

    $result = (new BroadcastPushHealthCheck)->run();

    expect($result->status->value)->toBe('ok')
        ->and($result->shortSummary)->toBe('Push disabled');
});

it('health check reports OK but clearly labeled as a stub when the log driver is active', function (): void {
    config(['broadcast.notifications.enabled' => true, 'broadcast.notifications.push_driver' => 'log']);

    $result = (new BroadcastPushHealthCheck)->run();

    expect($result->status->value)->toBe('ok')
        ->and($result->shortSummary)->toBe('Push stub (log only)');
});

it('health check fails when push is enabled but the driver is not configured', function (): void {
    config(['broadcast.notifications.enabled' => true]);
    $driver = Mockery::mock(BroadcastPushDriver::class);
    $driver->shouldReceive('name')->andReturn('fcm');
    $driver->shouldReceive('configured')->andReturn(false);
    app()->instance(BroadcastPushDriver::class, $driver);

    $result = (new BroadcastPushHealthCheck)->run();

    expect($result->status->value)->toBe('failed')
        ->and($result->shortSummary)->toBe('Push misconfigured');
});
