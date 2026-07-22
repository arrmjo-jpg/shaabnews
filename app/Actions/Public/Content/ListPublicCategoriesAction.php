<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Http\Resources\Public\Content\PublicCategoryResource;
use App\Models\Category;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Content\CategoryTree;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * قراءة عامة: شجرة التصنيفات الفعّالة للغة محدّدة (deterministic + cache).
 * تستهلك المورد العام السلِيم — لا تسريب لحقول إدارية.
 */
class ListPublicCategoriesAction
{
    public function handle(string $locale): JsonResponse
    {
        if (! in_array($locale, Category::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $payload = Cache::tags(['categories'])->remember(
            CacheKeys::categoriesTreePublic($locale),
            CacheTtl::METADATA,
            fn (): array => PublicCategoryResource::collection(
                CategoryTree::build(
                    Category::query()
                        ->active()
                        ->forLocale($locale)
                        ->with('bannerMedia')
                        ->orderBy('sort_order')
                        ->orderBy('id')
                        ->get()
                )
            )->resolve()
        );

        return ApiResponse::success(data: $payload);
    }
}
