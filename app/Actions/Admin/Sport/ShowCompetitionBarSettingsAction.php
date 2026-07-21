<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Models\Competition;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * يعيد حالة تفعيل "شريط بطولات" (Match Bar أو Sports Home Bar) + عدّاد البطولات المختارة له —
 * مشترك بين الميزتين، الفرق الوحيد عمود الاختيار. يُظهر لوحة الإدارة تحذيرًا فوريًّا حين يكون
 * الشريط مفعَّلاً بلا أيّ بطولة مختارة له (سيُعرَض شريط فارغ فيُخفى تلقائيًّا من الواجهة العامة —
 * التحذير هنا يمنع مفاجأة المحرّر لا أكثر).
 */
final class ShowCompetitionBarSettingsAction
{
    public function handle(bool $enabled, string $selectedColumn): JsonResponse
    {
        return ApiResponse::success(data: [
            'enabled' => $enabled,
            'eligible_competitions_count' => $enabled
                ? Competition::query()->where($selectedColumn, true)->count()
                : 0,
        ]);
    }
}
