<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Http\Resources\Admin\Broadcast\BroadcastCategoryResource;
use App\Models\BroadcastCategory;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * إنشاء تصنيف بثّ مسطّح (لا أب/هرمية ⇒ لا حارس تشجير، خلافاً لتصنيفات الفيديو).
 */
class CreateBroadcastCategoryAction
{
    public function handle(array $validated): JsonResponse
    {
        $category = new BroadcastCategory;
        $category->fill([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'cover_media_id' => $validated['cover_media_id'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
            'seo_title' => $validated['seo_title'] ?? null,
            'seo_description' => $validated['seo_description'] ?? null,
        ]);

        if (! empty($validated['slug'])) {
            $category->slug = $validated['slug'];
        }

        $category->save();

        Cache::tags([BroadcastCacheTags::ALL])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcastCategoryChange());

        return ApiResponse::success(
            __('broadcast_category.created'),
            new BroadcastCategoryResource($category),
            201
        );
    }
}
