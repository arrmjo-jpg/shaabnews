<?php

declare(strict_types=1);

namespace App\Support\Scheduler;

use App\Models\ScheduledTask;
use Cron\CronExpression;
use Illuminate\Support\Carbon;

/**
 * سجل المهام المجدوَلة — مصدر الحقيقة الوحيد (code-authoritative).
 * الأمر والتعبير ثابتان هنا فقط؛ المستخدم لا يعرّف/يعدّل أمراً أو تعبيراً.
 */
final class SchedulerRegistry
{
    /**
     * @return array<string, array{command:string, cron:string, frequency:string, critical:bool, manual_run_allowed:bool}>
     */
    public static function all(): array
    {
        return [
            'activity_log_cleanup' => [
                'command' => 'activitylog:clean',
                'cron' => '0 0 * * *',
                'frequency' => 'daily',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'backups_run' => [
                'command' => 'backup:run',
                'cron' => '0 2 * * *',
                'frequency' => 'dailyAt0200',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'backups_cleanup' => [
                'command' => 'backup:clean',
                'cron' => '0 3 * * *',
                'frequency' => 'dailyAt0300',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'backups_monitor' => [
                'command' => 'backup:monitor',
                'cron' => '0 4 * * *',
                'frequency' => 'dailyAt0400',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'password_reset_cleanup' => [
                'command' => 'auth:clear-resets',
                'cron' => '0 1 * * *',
                'frequency' => 'dailyAt0100',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'queue_failed_prune' => [
                'command' => 'queue:prune-failed --hours=168',
                'cron' => '30 1 * * *',
                'frequency' => 'dailyAt0130',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'queue_batches_prune' => [
                'command' => 'queue:prune-batches --hours=48',
                'cron' => '0 5 * * *',
                'frequency' => 'dailyAt0500',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'sanctum_tokens_prune' => [
                'command' => 'sanctum:prune-expired --hours=24',
                'cron' => '30 5 * * *',
                'frequency' => 'dailyAt0530',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'articles_publish_due' => [
                'command' => 'articles:publish-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'reels_publish_due' => [
                'command' => 'reels:publish-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'videos_publish_due' => [
                'command' => 'videos:publish-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'epapers_publish_due' => [
                'command' => 'epapers:publish-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'broadcasts_go_live_due' => [
                'command' => 'broadcasts:go-live-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'broadcasts_health_check' => [
                'command' => 'broadcasts:health-check',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'broadcasts_sync_viewer_counts' => [
                'command' => 'broadcasts:sync-viewer-counts',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'broadcasts_dispatch_reminders' => [
                'command' => 'broadcasts:dispatch-reminders',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'engagement_flush_views' => [
                'command' => 'engagement:flush-views',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'ads_flush_events' => [
                'command' => 'ads:flush-events',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'ads_campaigns_tick' => [
                'command' => 'ads:campaigns-tick',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'whatsapp_campaigns_tick' => [
                'command' => 'whatsapp:campaigns-tick',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'media_orphans_prune' => [
                'command' => 'media:prune-orphans',
                'cron' => '15 4 * * *',
                'frequency' => 'dailyAt0415',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'media_sync_remote' => [
                'command' => 'media:sync:remote',
                'cron' => '*/10 * * * *',
                'frequency' => 'everyTenMinutes',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'follows_sync_fixtures' => [
                'command' => 'follows:sync-fixtures',
                'cron' => '*/10 * * * *',
                'frequency' => 'everyTenMinutes',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'follows_dispatch_reminders' => [
                'command' => 'follows:dispatch-reminders',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'follows_poll_live' => [
                'command' => 'follows:poll-live',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'competitions_sync_fixtures' => [
                'command' => 'competitions:sync-fixtures',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'notifications_probe_channels' => [
                'command' => 'notifications:probe-channels',
                'cron' => '*/10 * * * *',
                'frequency' => 'everyTenMinutes',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
            'notifications_dispatch_due' => [
                'command' => 'notifications:dispatch-due',
                'cron' => '* * * * *',
                'frequency' => 'everyMinute',
                'critical' => true,
                'manual_run_allowed' => true,
            ],
            'notifications_reconcile' => [
                'command' => 'notifications:reconcile-campaigns',
                'cron' => '*/15 * * * *',
                'frequency' => 'everyFifteenMinutes',
                'critical' => false,
                'manual_run_allowed' => true,
            ],
        ];
    }

    /** @return array{command:string, cron:string, frequency:string, critical:bool, manual_run_allowed:bool}|null */
    public static function find(string $key): ?array
    {
        return self::all()[$key] ?? null;
    }

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::all());
    }

    /** سجل الحالة (يُنشأ كسولاً، مفعّل افتراضياً). */
    public static function state(string $key): ScheduledTask
    {
        return ScheduledTask::firstOrCreate(['key' => $key], ['enabled' => true]);
    }

    public static function isEnabled(string $key): bool
    {
        return (bool) (ScheduledTask::where('key', $key)->value('enabled') ?? true);
    }

    public static function nextRunAt(string $cron): ?Carbon
    {
        try {
            return Carbon::instance((new CronExpression($cron))->getNextRunDate());
        } catch (\Throwable) {
            return null;
        }
    }

    public static function previousExpectedAt(string $cron): ?Carbon
    {
        try {
            return Carbon::instance((new CronExpression($cron))->getPreviousRunDate());
        } catch (\Throwable) {
            return null;
        }
    }
}
