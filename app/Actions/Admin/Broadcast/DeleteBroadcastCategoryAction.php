<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Models\BroadcastCategory;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DeleteBroadcastCategoryAction
{
    public function handle(BroadcastCategory $category): JsonResponse
    {
        $category->delete();

        Cache::tags([BroadcastCacheTags::ALL])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcastCategoryChange());

        return ApiResponse::success(__('broadcast_category.deleted'));
    }
}
