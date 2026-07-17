<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Enums\BroadcastSourceType;
use App\Enums\BroadcastStatus;
use App\Models\Broadcast;
use App\Models\BroadcastHealthCheck;
use App\Support\Broadcast\BroadcastProbeResult;
use App\Support\Broadcast\BroadcastSourceProbe;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use Illuminate\Support\Facades\Cache;

/**
 * مراقبة صحّة مصادر البثّ — يفحص البثّ المباشر/الفاشل المستحقّ (تواتر متدرّج حسب
 * النوع)، يسجّل التاريخ، يحدّث اللقطة، ويطبّق قاطع الدائرة:
 *   - live + إخفاقات متتالية ≥ عتبة ⇒ live → failed (لا ارتعاش على عطل عابر).
 *   - failed + فحص سليم ⇒ **استرجاع نظام** failed → live (مسار صحّي مُتحقَّق فقط؛
 *     خلافاً للمصفوفة اليدوية التي تمنع failed→live).
 * offline لا يُفحَص (حالة مقصودة)؛ scheduled/draft/ended/archived لا تُفحَص.
 * المصادر غير القابلة للفحص (يوتيوب/مزوّد خارجي) مُستبعَدة أصلاً.
 */
final class MonitorBroadcastHealthAction
{
    /** @return array{checked:int, failed:int, recovered:int} */
    public function handle(): array
    {
        $probeableTypes = array_values(array_filter(
            BroadcastSourceType::values(),
            fn (string $t): bool => BroadcastSourceType::from($t)->isProbeable(),
        ));

        $candidates = Broadcast::query()
            ->whereIn('status', [BroadcastStatus::Live->value, BroadcastStatus::Failed->value])
            ->whereIn('source_type', $probeableTypes)
            ->get();

        $probe = new BroadcastSourceProbe;
        $checked = 0;
        $failed = 0;
        $recovered = 0;

        foreach ($candidates as $broadcast) {
            if (! $this->isDue($broadcast)) {
                continue;
            }

            $result = $probe->probe($broadcast);
            if (! $result->probeable) {
                continue; // أمان (مُستبعَد أصلاً بالترشيح)
            }

            $checked++;
            $this->record($broadcast, $result);

            $outcome = $this->applyAntiFlap($broadcast, $result);
            if ($outcome === 'failed') {
                $failed++;
            } elseif ($outcome === 'recovered') {
                $recovered++;
            }
        }

        return ['checked' => $checked, 'failed' => $failed, 'recovered' => $recovered];
    }

    /** هل حان موعد الفحص حسب التواتر المتدرّج (live أسرع من tv/radio)؟ */
    private function isDue(Broadcast $broadcast): bool
    {
        if ($broadcast->last_health_check_at === null) {
            return true;
        }

        $cadence = (int) (config('broadcast.health.cadence.'.$broadcast->kind->value) ?? 300);

        return $broadcast->last_health_check_at->lte(now()->subSeconds($cadence));
    }

    private function record(Broadcast $broadcast, BroadcastProbeResult $result): void
    {
        $now = now();

        BroadcastHealthCheck::create([
            'broadcast_id' => $broadcast->id,
            'status' => $result->healthy ? 'healthy' : 'failed',
            'latency_ms' => $result->latencyMs,
            'failure_reason' => $result->reason,
            'checked_at' => $now,
        ]);

        // تقليم نافذة الاحتجاز — يمنع النمو غير المحدود (تشغيلياً سليم).
        $retentionDays = (int) config('broadcast.health.history_retention_days', 30);
        BroadcastHealthCheck::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('checked_at', '<', $now->copy()->subDays($retentionDays))
            ->delete();
    }

    /** @return string|null 'failed' | 'recovered' | null (نتيجة الانتقال إن حدث) */
    private function applyAntiFlap(Broadcast $broadcast, BroadcastProbeResult $result): ?string
    {
        $now = now();

        if ($result->healthy) {
            $wasFailed = $broadcast->status === BroadcastStatus::Failed;
            $broadcast->health_consecutive_failures = 0;
            $broadcast->last_health_status = 'healthy';
            $broadcast->last_health_message = null;
            $broadcast->last_health_check_at = $now;

            if ($wasFailed) {
                // مسار الاسترجاع النظامي الوحيد المُصرَّح به: failed → live (مُتحقَّق صحّياً).
                $broadcast->status = BroadcastStatus::Live->value;
                $broadcast->started_at = $broadcast->started_at ?? $now;
                $broadcast->save();
                $this->flush($broadcast);

                return 'recovered';
            }

            $broadcast->save();

            return null;
        }

        // فحص فاشل — راكم العدّاد.
        $broadcast->health_consecutive_failures = (int) $broadcast->health_consecutive_failures + 1;
        $broadcast->last_health_status = 'failed';
        $broadcast->last_health_message = $result->reason;
        $broadcast->last_health_check_at = $now;

        $threshold = (int) config('broadcast.health.fail_threshold', 3);

        if ($broadcast->status === BroadcastStatus::Live
            && $broadcast->health_consecutive_failures >= $threshold
            && $broadcast->status->canTransitionTo(BroadcastStatus::Failed)) {
            // قاطع الدائرة: لا نُفشّل إلا بعد عتبة إخفاقات متتالية (مقاومة الارتعاش).
            $broadcast->status = BroadcastStatus::Failed->value;
            $broadcast->save();
            $this->flush($broadcast);

            return 'failed';
        }

        $broadcast->save();

        return null;
    }

    private function flush(Broadcast $broadcast): void
    {
        $broadcast->loadMissing('category');
        Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));
    }
}
