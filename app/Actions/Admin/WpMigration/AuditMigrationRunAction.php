<?php

declare(strict_types=1);

namespace App\Actions\Admin\WpMigration;

use App\Http\Resources\Admin\WpMigration\MigrationRunResource;
use App\Models\MigrationRun;
use App\Support\Responses\ApiResponse;
use App\Support\WpMigration\WpMediaSource;
use App\Support\WpMigration\WpSourceInspector;
use Illuminate\Http\JsonResponse;

/**
 * تدقيق المصدر (قراءة فقط) — يجمع حقائق المصدر ويخزّنها في التشغيلة. طور الاكتشاف.
 */
class AuditMigrationRunAction
{
    public function handle(MigrationRun $run): JsonResponse
    {
        $inspector = WpSourceInspector::for($run);

        if (! $inspector->canConnect()) {
            return ApiResponse::error(__('wp_migration.connection.failed'), [], 422);
        }

        $facts = $inspector->facts();

        // فحص مسبق لمسار الوسائط (للقراءة فقط) — يُعرَض في التدقيق، ويُفرَض
        // كبوّابة صلبة قبل التنفيذ (الموجة اللاحقة). الفشل المبكر أفضل.
        $uploadsPath = trim((string) $run->uploads_path);
        $facts['media']['uploads_path'] = $uploadsPath !== '' ? $uploadsPath : null;
        $facts['media']['uploads_readable'] = $uploadsPath !== ''
            && is_dir($uploadsPath)
            && is_readable($uploadsPath);

        // مصدر الوسائط الفعليّ: «remote» عند ضبط WP_BASE_URL (تنزيل من الموقع الحيّ
        // — لا نسخة محلّية مطلوبة) وإلا «local». يُعرَض كي لا يُقرَأ
        // uploads_readable=false على أنه مانع بينما المصدر بعيد أصلاً.
        $facts['media']['source'] = WpMediaSource::enabled() ? 'remote' : 'local';
        $facts['media']['base_url'] = WpMediaSource::baseUrl();

        $run->update(['source_facts' => $facts]);

        return ApiResponse::success(__('wp_migration.audit.done'), new MigrationRunResource($run->fresh()));
    }
}
