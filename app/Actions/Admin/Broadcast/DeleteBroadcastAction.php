<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Models\Broadcast;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * حذف ناعم لبثّ (قابل للاسترجاع — الاسترجاع/الحذف النهائي يُضافان في مرحلة لاحقة).
 */
class DeleteBroadcastAction
{
    public function handle(Broadcast $broadcast): JsonResponse
    {
        $broadcast->loadMissing('category');
        $broadcast->delete();

        Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));

        return ApiResponse::success(__('broadcast.deleted'));
    }
}
