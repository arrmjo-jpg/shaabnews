<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\SportMenuItemResource;
use App\Models\SportMenuItem;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/** قائمة عناصر القائمة الكاملة كشجرة (جذور + children) — حجم متوقَّع صغير، بلا ترقيم صفحات. */
final class ListSportMenuItemsAction
{
    public function handle(): JsonResponse
    {
        $items = SportMenuItem::query()
            ->whereNull('parent_id')
            ->with(['children' => fn ($q) => $q->orderBy('order')])
            ->orderBy('order')
            ->get();

        return ApiResponse::success(data: SportMenuItemResource::collection($items));
    }
}
