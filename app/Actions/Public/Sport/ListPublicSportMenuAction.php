<?php

declare(strict_types=1);

namespace App\Actions\Public\Sport;

use App\Http\Resources\Public\Sport\PublicSportMenuItemResource;
use App\Models\SportMenuItem;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * قراءة عامّة فقط لقائمة "أقسام الرياضة" (Header 1's Sections dropdown) — شجرة الجذور
 * المفعّلة (enabled=true) بلغة الطلب فقط، مع أبنائها المفعّلين بنفس اللغة. عمداً منفصلة عن
 * ListSportMenuItemsAction (الإداريّة، تعيد كل شيء بلا تصفية enabled/locale لأنّ المحرِّر يحتاج
 * رؤية العناصر المعطّلة لإعادة تفعيلها) — الاستهلاك مختلف تمامًا فلا معنى لمشاركة نفس الاستعلام.
 */
final class ListPublicSportMenuAction
{
    public function handle(string $locale): JsonResponse
    {
        $items = SportMenuItem::query()
            ->whereNull('parent_id')
            ->where('enabled', true)
            ->where('locale', $locale)
            ->with(['children' => fn ($q) => $q
                ->where('enabled', true)
                ->where('locale', $locale)
                ->orderBy('order')])
            ->orderBy('order')
            ->get();

        return ApiResponse::success(data: PublicSportMenuItemResource::collection($items));
    }
}
