<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Models\SportMenuItem;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * إعادة ترتيب عناصر قائمة الرياضة (على نفس مستوى الأب) بقائمة معرّفات مرتّبة — نمط طبق الأصل من
 * ReorderCompetitionsBarAction. يُحدِّث فقط الصفوف التي تغيّر ترتيبها، عبر forceFill()->save().
 *
 * @param  array<int,int>  $ids
 */
final class ReorderSportMenuItemsAction
{
    public function handle(array $ids): JsonResponse
    {
        DB::transaction(function () use ($ids): void {
            foreach (array_values($ids) as $position => $id) {
                $item = SportMenuItem::find($id);
                if ($item !== null && $item->order !== $position) {
                    $item->forceFill(['order' => $position])->save();
                }
            }
        });

        FrontendRevalidate::tags(['sport-menu']);

        return ApiResponse::success(__('sport.menu_items_reordered'));
    }
}
