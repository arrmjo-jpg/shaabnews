<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\CompetitionResource;
use App\Models\Competition;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * تبديل عمود اختيار "شريط بطولات" (Match Bar أو Sports Home Bar) — مشترك بين الميزتين، الفرق
 * الوحيد أعمدة الاختيار/الترتيب ووسم الكاش (نمط TogglePollActiveAction — بلا جسم طلب، قلب الحالة
 * الحاليّة). تفعيل يُلحِق البطولة بآخر القائمة المفعَّلة حاليًّا لهذا الشريط تحديدًا (الترتيب =
 * أعلى ترتيب موجود + 1)، محسوبًا من الباك إند لا الواجهة. تعطيل يبدّل العلم فقط؛ ترتيبها السابق
 * يبقى كما هو دون قراءة، وتُلحَق من جديد بآخر القائمة إن أُعيد تفعيلها لاحقًا (لا استرجاع للموضع
 * القديم).
 *
 * التفعيل مغلَّف بـ DB::transaction() + lockForUpdate() — قراءة قافلة تمنع Race Condition بين
 * طلبين متزامنين لتفعيل بطولتين مختلفتين لنفس الشريط (مُثبَت فعليًّا بمحاكاة متزامنة). التعطيل
 * لا يحتاج قفلًا: لا يقرأ/يحسب أي قيمة مشتقّة.
 */
final class ToggleCompetitionBarSelectionAction
{
    public function handle(Competition $competition, string $selectedColumn, string $sortColumn, string $cacheTag): JsonResponse
    {
        if ($competition->{$selectedColumn}) {
            $competition->update([$selectedColumn => false]);
        } else {
            DB::transaction(function () use ($competition, $selectedColumn, $sortColumn): void {
                $nextOrder = (int) (Competition::query()
                    ->where($selectedColumn, true)
                    ->lockForUpdate()
                    ->max($sortColumn) ?? -1) + 1;

                $competition->update([$selectedColumn => true, $sortColumn => $nextOrder]);
            });
        }

        FrontendRevalidate::tags([$cacheTag]);

        return ApiResponse::success(__('sport.competition_updated'), new CompetitionResource($competition));
    }
}
