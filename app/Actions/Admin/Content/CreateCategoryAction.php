<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Enums\CategoryScope;
use App\Enums\CategoryStatus;
use App\Http\Resources\Admin\Content\CategoryResource;
use App\Models\Category;
use App\Support\Content\CategoryHierarchyGuard;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class CreateCategoryAction
{
    public function handle(array $validated): JsonResponse
    {
        $parentId = $validated['parent_id'] ?? null;
        $locale = $validated['locale'];

        if ($denied = CategoryHierarchyGuard::check(null, $parentId, $locale)) {
            return $denied;
        }

        $category = new Category;
        $category->fill([
            'parent_id' => $parentId,
            'locale' => $locale,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? null,
            'scope' => $validated['scope'] ?? CategoryScope::Both->value,
            'status' => $validated['status'] ?? CategoryStatus::Active->value,
            'show_in_header' => $validated['show_in_header'] ?? false,
            'show_in_body' => $validated['show_in_body'] ?? true,
            'show_in_footer' => $validated['show_in_footer'] ?? false,
            'sort_order' => $validated['sort_order'] ?? 0,
            'provider' => $validated['provider'] ?? null,
            'external_id' => $validated['external_id'] ?? null,
        ]);

        // slug صريح اختياري — وإلا يولّده Sluggable (عربي-المحافظة، فريد/لغة)
        if (! empty($validated['slug'])) {
            $category->slug = $validated['slug'];
        }

        $category->save();

        Cache::tags(['categories'])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::category($category));

        return ApiResponse::success(
            __('category.created'),
            new CategoryResource($category),
            201
        );
    }
}
