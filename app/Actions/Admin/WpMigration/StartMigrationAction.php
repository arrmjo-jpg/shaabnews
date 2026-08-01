<?php

declare(strict_types=1);

namespace App\Actions\Admin\WpMigration;

use App\Enums\MigrationRunStatus;
use App\Http\Resources\Admin\WpMigration\MigrationRunResource;
use App\Jobs\WpMigration\DispatchMigrationChunkJob;
use App\Models\MigrationRun;
use App\Support\Responses\ApiResponse;
use App\Support\WpMigration\MigrationAuthor;
use App\Support\WpMigration\WpMediaSource;
use App\Support\WpMigration\WpSourceInspector;
use Illuminate\Http\JsonResponse;

/**
 * يبدأ التنفيذ خلف بوّابة صلبة من جهة الخادم (قاعدة #9) — لا تُؤتمَن الواجهة وحدها:
 *   - ليست في طور فعّال (لا بدء فوق تشغيلة جارية — تُستأنف لا تُبدأ).
 *   - canExecute: سياسة تعارض + معاينة حالية + اعتماد.
 *   - وجود الكاتب القانوني «كتاب الموقع» (فحص صارم #8 — لا إنشاء تلقائيّ هنا).
 *   - مسار الوسائط موجود وقابل للقراءة (preflight #5).
 *   - اتصال حيّ بالمصدر (قراءة فقط).
 *
 * عند المرور: running + ختم البدء، ثمّ بذر لقطة الدفتر مرّة (#1) وإطلاق المُوزِّع
 * ذاتيّ الجدولة. إعادة البدء على تشغيلة منتهية تستأنف من الدفتر (#11) — البذر idempotent.
 */
class StartMigrationAction
{
    public function handle(MigrationRun $run, bool $incremental = false): JsonResponse
    {
        if ($run->status->isActive()) {
            return ApiResponse::error(__('wp_migration.run.not_executable'), [], 422);
        }

        if (! $run->canExecute()) {
            return ApiResponse::error(__('wp_migration.run.not_executable'), [], 422);
        }

        if (! MigrationAuthor::exists()) {
            return ApiResponse::error(__('wp_migration.run.author_missing'), [], 422);
        }

        // مسار الوسائط المحلّي شرطٌ للوضع المحلّي وحده. عند ضبط WP_BASE_URL تُنزَّل
        // الوسائط من الموقع الحيّ فلا نسخة محلّية مطلوبة — والحارس هنا كان سيمنع
        // البدء بلا سبب (422) رغم أن المصدر متاح بالكامل عبر الشبكة.
        if (! WpMediaSource::enabled()) {
            $uploads = (string) $run->uploads_path;
            if ($uploads === '' || ! is_dir($uploads) || ! is_readable($uploads)) {
                return ApiResponse::error(__('wp_migration.run.uploads_unreadable'), [], 422);
            }
        }

        if (! WpSourceInspector::for($run)->canConnect()) {
            return ApiResponse::error(__('wp_migration.connection.failed'), [], 422);
        }

        $run->forceFill([
            'status' => MigrationRunStatus::Running->value,
            'started_at' => $run->started_at ?? now(),
            'finished_at' => null,
            'timeline' => $run->withEvent('started'),
        ])->save();

        SeedLedgerAction::for($run, $incremental)->handle($run);

        DispatchMigrationChunkJob::dispatch($run->id);

        return ApiResponse::success(__('wp_migration.run.started'), new MigrationRunResource($run->fresh()));
    }
}
