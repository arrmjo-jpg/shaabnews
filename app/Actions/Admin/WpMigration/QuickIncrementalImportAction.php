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
 * ⚠️ TEMPORARY FEATURE
 * Quick Incremental Import
 * Remove before Production release
 *
 * TODO(production): قبل الإطلاق — احذف هذا الاختصار بالكامل (هذا الإجراء + المسار +
 * دالّة الكنترولر + علم المورد + الزرّ بالواجهة)، أو عطّله نهائياً عبر
 * WP_MIGRATION_QUICK_INCREMENTAL=false. يجب ألّا يصبح جزءاً دائماً من نظام الترحيل.
 *
 * اختصار «استيراد الجديد فقط» (تطوير/اختبار فقط):
 *
 * يُشغّل الترحيل التزايديّ بضغطة واحدة دون إعادة تدقيق/معاينة/اعتماد، بإعادة استخدام
 * آليّة التزايد القائمة **كما هي** (SeedLedgerAction incremental + المُوزِّع) — بلا أيّ
 * تغيير في منطق الترحيل أو سياسة المطابقة أو المعرّفات أو آليّة التزايد. يعتمد على آخر
 * سياسة وتنسيب مُعتمَدَين (المخزَّنَين على التشغيلة). البوّابة الوحيدة المُخفَّفة: «اعتُمِد
 * سابقاً مرّة» بدل «معاينة حاليّة» — وكلّ بقيّة الحُرّاس (كاتب/uploads/اتصال) كما هي.
 *
 * 🔒 يُعطَّل/يُزال في الإنتاج: WP_MIGRATION_QUICK_INCREMENTAL=false ⇒ يعود التدفّق
 * الرسميّ الكامل (StartMigrationAction). لا يمسّ هذا الاختصارُ التدفّقَ الرسميّ إطلاقاً.
 */
class QuickIncrementalImportAction
{
    public function handle(MigrationRun $run): JsonResponse
    {
        if (! (bool) config('wp-migration.quick_incremental', false)) {
            return ApiResponse::error(__('wp_migration.run.quick_disabled'), [], 403);
        }

        if ($run->status->isActive()) {
            return ApiResponse::error(__('wp_migration.run.not_executable'), [], 422);
        }

        // بوّابة مُخفَّفة: اعتُمِد سابقاً (سياسة + اعتماد) — دون اشتراط معاينة حاليّة.
        if ($run->conflict_policy === null || $run->approved_at === null) {
            return ApiResponse::error(__('wp_migration.run.never_approved'), [], 422);
        }

        if (! MigrationAuthor::exists()) {
            return ApiResponse::error(__('wp_migration.run.author_missing'), [], 422);
        }

        // كما في StartMigrationAction: الشرط يخصّ الوضع المحلّي وحده.
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

        // آليّة التزايد القائمة كما هي (مطابِقة لـ StartMigrationAction مع incremental:true).
        SeedLedgerAction::for($run, incremental: true)->handle($run);
        DispatchMigrationChunkJob::dispatch($run->id);

        return ApiResponse::success(__('wp_migration.run.started'), new MigrationRunResource($run->fresh()));
    }
}
