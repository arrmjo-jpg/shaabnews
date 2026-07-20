<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Models\SportMenuItem;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class DeleteSportMenuItemAction
{
    public function handle(SportMenuItem $item): JsonResponse
    {
        $item->delete();

        FrontendRevalidate::tags(['sport-menu']);

        return ApiResponse::success(__('sport.menu_item_deleted'));
    }
}
