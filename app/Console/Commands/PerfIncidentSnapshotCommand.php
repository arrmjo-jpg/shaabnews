<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;

/**
 * يُشغَّل فور حدوث التعليق لجمع لقطة كاملة من الإنتاج:
 *   - SHOW FULL PROCESSLIST
 *   - SHOW ENGINE INNODB STATUS
 *   - Redis INFO stats + مفاتيح القفل النشطة (swr:*) عبر SCAN
 *   - آخر 200 سطر من perf.log (يحتوي SQL بطيء + CachedRead events)
 *   - آخر 100 سطر من laravel.log
 *   - performance_schema كقسم استشاري إضافي (قد لا يكون مفعّلاً)
 *
 * الاستخدام على الخادم:
 *   php artisan perf:incident-snapshot
 *
 * أو بعد الحادثة:
 *   php artisan perf:incident-snapshot --at="2026-07-08 02:15:00"
 */
class PerfIncidentSnapshotCommand extends Command
{
    protected $signature = 'perf:incident-snapshot
                              {--at= : timestamp الحادثة (Y-m-d H:i:s)}
                              {--slow-threshold=1 : الحد الأدنى للاستعلام البطيء بالثواني (performance_schema فقط)}';

    protected $description = 'Collect production evidence during or after a DB/cache hang incident';

    public function handle(): int
    {
        $at = $this->option('at') ? Carbon::parse($this->option('at')) : now();
        $threshold = (int) $this->option('slow-threshold');
        $ts = $at->format('Y-m-d_H-i-s');
        $filename = "perf/incident_{$ts}.txt";

        $this->info("Collecting incident snapshot -- {$at->toIso8601String()}");

        $lines = [];
        $lines[] = str_repeat('=', 80);
        $lines[] = "ALPHACMS INCIDENT SNAPSHOT -- {$at->toIso8601String()}";
        $lines[] = 'Collected at: '.now()->toIso8601String();
        $lines[] = str_repeat('=', 80);
        $lines[] = '';

        // ── 1. SHOW FULL PROCESSLIST ──────────────────────────────────────────
        $lines[] = str_repeat('-', 60).' SHOW FULL PROCESSLIST';
        try {
            $processes = DB::select('SHOW FULL PROCESSLIST');
            if (empty($processes)) {
                $lines[] = '(no active processes)';
            } else {
                $lines[] = sprintf('%-8s %-10s %-20s %-10s %-12s %-8s %s',
                    'Id', 'User', 'Host', 'db', 'Command', 'Time', 'Info');
                foreach ($processes as $p) {
                    $lines[] = sprintf('%-8s %-10s %-20s %-10s %-12s %-8s %s',
                        $p->Id ?? $p->id ?? '-',
                        $p->User ?? $p->user ?? '-',
                        $p->Host ?? $p->host ?? '-',
                        $p->db ?? '-',
                        $p->Command ?? $p->command ?? '-',
                        $p->Time ?? $p->time ?? '-',
                        mb_strimwidth($p->Info ?? $p->info ?? '', 0, 120));
                }
            }
        } catch (\Throwable $e) {
            $lines[] = "ERROR: {$e->getMessage()}";
        }
        $lines[] = '';

        // ── 2. SHOW ENGINE INNODB STATUS ──────────────────────────────────────
        $lines[] = str_repeat('-', 60).' SHOW ENGINE INNODB STATUS';
        try {
            $innodb = DB::select('SHOW ENGINE INNODB STATUS');
            $lines[] = $innodb[0]->Status ?? $innodb[0]->status ?? '(empty)';
        } catch (\Throwable $e) {
            $lines[] = "ERROR: {$e->getMessage()}";
        }
        $lines[] = '';

        // ── 3. REDIS INFO ──────────────────────────────────────────────────────
        $lines[] = str_repeat('-', 60).' REDIS INFO (keyspace + stats)';
        try {
            $redisClient = Redis::connection()->client();
            $info = $redisClient->info();
            foreach (['Server', 'Clients', 'Memory', 'Stats', 'Keyspace'] as $section) {
                if (! empty($info[$section])) {
                    $lines[] = "[ {$section} ]";
                    foreach ($info[$section] as $k => $v) {
                        $lines[] = "  {$k}: {$v}";
                    }
                    $lines[] = '';
                }
            }
        } catch (\Throwable $e) {
            $lines[] = "ERROR (Redis INFO): {$e->getMessage()}";
        }

        // ── 4. ACTIVE SWR LOCKS via SCAN (آمن للإنتاج) ────────────────────────
        $lines[] = str_repeat('-', 60).' ACTIVE STAMPEDE LOCKS via SCAN (swr:*)';
        try {
            $redisClient = Redis::connection()->client();
            $prefix = config('cache.prefix', 'laravel_cache');
            $pattern = "{$prefix}*swr:*";
            $found = [];

            $cursor = null;
            do {
                // SCAN بدلاً من KEYS — لا يحجب Redis ولو كان فيه ملايين مفاتيح
                [$cursor, $batch] = $redisClient->scan($cursor ?? '0', 'MATCH', $pattern, 'COUNT', 200);
                foreach ($batch as $k) {
                    $found[] = $k;
                }
            } while ($cursor !== '0' && $cursor !== 0);

            if (empty($found)) {
                $lines[] = '(no active swr: locks found)';
            } else {
                foreach ($found as $k) {
                    $ttl = $redisClient->ttl($k);
                    $value = $redisClient->get($k);
                    $lines[] = "  key={$k}  ttl={$ttl}s  value={$value}";
                }
            }
        } catch (\Throwable $e) {
            $lines[] = "ERROR (Redis SCAN): {$e->getMessage()}";
        }
        $lines[] = '';

        // ── 5. PHP-FPM STATUS ──────────────────────────────────────────────────
        $lines[] = str_repeat('-', 60).' PHP-FPM STATUS';
        try {
            $status = @file_get_contents('http://127.0.0.1/fpm-status?json');
            $lines[] = $status ?: '(fpm-status not reachable -- add pm.status_path=/fpm-status to pool config)';
        } catch (\Throwable) {
            $lines[] = '(fpm-status not reachable)';
        }
        $lines[] = '';

        // ── 6. LAST 200 LINES -- perf.log (PRIMARY EVIDENCE SOURCE) ──────────
        // هذا هو المصدر الرئيسي: يحتوي SQL بطيء من DB::listen + CachedRead events
        $lines[] = str_repeat('-', 60).' LAST 200 LINES -- perf.log (PRIMARY)';
        $perfLog = storage_path('logs/perf-'.now()->format('Y-m-d').'.log');
        if (file_exists($perfLog)) {
            $lines = array_merge($lines, array_slice(file($perfLog), -200));
        } else {
            $lines[] = '(perf.log not found -- no CachedRead events recorded yet)';
        }
        $lines[] = '';

        // ── 7. LAST 100 LINES -- laravel.log ──────────────────────────────────
        $lines[] = str_repeat('-', 60).' LAST 100 LINES -- laravel.log';
        $mainLog = storage_path('logs/laravel.log');
        if (file_exists($mainLog)) {
            $lines = array_merge($lines, array_slice(file($mainLog), -100));
        } else {
            $lines[] = '(laravel.log not found)';
        }
        $lines[] = '';

        // ── 8. PERFORMANCE SCHEMA (استشاري -- قد لا يكون مفعّلاً) ────────────
        $lines[] = str_repeat('-', 60)." [SUPPLEMENTARY] performance_schema slow queries >= {$threshold}s";
        $lines[] = '(هذا القسم استشاري فقط -- قد يكون معطلاً أو يعطي إحصاءات مجمعة وليس الاستعلامات الحية)';
        try {
            $slow = DB::select('
                SELECT DIGEST_TEXT, COUNT_STAR,
                       ROUND(AVG_TIMER_WAIT / 1000000000, 0) AS avg_ms,
                       ROUND(MAX_TIMER_WAIT / 1000000000, 0) AS max_ms,
                       LAST_SEEN
                FROM   performance_schema.events_statements_summary_by_digest
                WHERE  AVG_TIMER_WAIT / 1000000000 >= ?
                ORDER  BY AVG_TIMER_WAIT DESC
                LIMIT  20
            ', [$threshold * 1000]);
            if (empty($slow)) {
                $lines[] = "(no queries above {$threshold}s in performance_schema)";
            } else {
                foreach ($slow as $row) {
                    $lines[] = sprintf(
                        "avg=%.0fms | max=%.0fms | calls=%d | last=%s\n  %s\n",
                        $row->avg_ms, $row->max_ms, $row->COUNT_STAR,
                        $row->LAST_SEEN,
                        mb_strimwidth($row->DIGEST_TEXT, 0, 200));
                }
            }
        } catch (\Throwable $e) {
            $lines[] = "performance_schema not available: {$e->getMessage()}";
        }

        // ── Write snapshot ────────────────────────────────────────────────────
        Storage::disk('local')->put($filename, implode("\n", $lines));
        $path = storage_path("app/{$filename}");

        $this->newLine();
        $this->info("Snapshot written to: {$path}");
        $this->line('Share this file when reporting the incident.');

        return self::SUCCESS;
    }
}
