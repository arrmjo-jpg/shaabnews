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

class UpdateBroadcastCategoryAction
{
    public function handle(BroadcastCategory $category, array $validated): JsonResponse
    {
        foreach (['name', 'description', 'cover_media_id', 'sort_order', 'seo_title', 'seo_description'] as $field) {
            if (array_key_exists($field, $validated)) {
                $category->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('is_active', $validated)) {
            $category->is_active = (bool) $validated['is_active'];
        }

        if (array_key_exists('slug', $validated) && ! empty($validated['slug'])) {
            $category->slug = $validated['slug'];
        }

        $category->save();

        Cache::tags([BroadcastCacheTags::ALL])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcastCategoryChange());

        return ApiResponse::success(
            __('broadcast_category.updated'),
            new BroadcastCategoryResource($category->fresh())
        );
    }
}
