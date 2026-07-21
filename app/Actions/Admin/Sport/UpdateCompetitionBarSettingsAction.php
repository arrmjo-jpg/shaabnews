<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Settings\BarSettings;
use App\Support\Audit\SettingsAudit;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * يحدّث مفتاح تفعيل/تعطيل "شريط بطولات" (Match Bar أو Sports Home Bar) — مشترك بين الميزتين
 * عبر BarSettings (القاعدة المجرَّدة المشتركة)، الفرق الوحيد اسم مجموعة التدقيق ووسم الكاش.
 */
final class UpdateCompetitionBarSettingsAction
{
    public function handle(BarSettings $settings, bool $enabled, string $auditGroup, string $cacheTag): JsonResponse
    {
        $settings->enabled = $enabled;
        $settings->save();

        // حالة غير Eloquent (Spatie Settings) ⇒ تدقيق يدويّ بأسماء المفاتيح فقط.
        SettingsAudit::log($auditGroup, ['enabled']);

        // إبطال فوريّ — المحرّر لا ينتظر انتهاء صلاحية كاش ليرى أثر تبديل التفعيل.
        FrontendRevalidate::tags([$cacheTag]);

        return ApiResponse::success(__('sport.bar_settings_updated'), ['enabled' => $settings->enabled]);
    }
}
