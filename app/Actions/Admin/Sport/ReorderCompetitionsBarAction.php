<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Models\Competition;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * إعادة ترتيب البطولات المختارة بـ"شريط بطولات" (Match Bar أو Sports Home Bar) بقائمة معرّفات
 * مرتّبة (عمود الترتيب = الفهرس) — مشترك بين الميزتين، الفرق الوحيد عمود الترتيب ووسم الكاش.
 * نسخة رابعة طبق الأصل من نمط ReorderTeamMembersAction. يُحدِّث فقط الصفوف التي تغيّر ترتيبها،
 * عبر forceFill()->save() (لا استعلام update() خام) احترامًا لقاعدة model-audit.
 *
 * @param  array<int,int>  $ids
 */
final class ReorderCompetitionsBarAction
{
    public function handle(array $ids, string $sortColumn, string $cacheTag): JsonResponse
    {
        DB::transaction(function () use ($ids, $sortColumn): void {
            foreach (array_values($ids) as $position => $id) {
                $competition = Competition::find($id);
                if ($competition !== null && $competition->{$sortColumn} !== $position) {
                    $competition->forceFill([$sortColumn => $position])->save();
                }
            }
        });

        FrontendRevalidate::tags([$cacheTag]);

        return ApiResponse::success(__('sport.competitions_reordered'));
    }
}
