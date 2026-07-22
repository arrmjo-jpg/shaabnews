<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Http\Resources\Public\Content\PublicCategoryResource;
use App\Models\Category;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * تفاصيل تصنيف فعّال للقراءة العامة بالـ (locale + slug).
 * الأبناء مُحمَّلون للاستهلاك في صفحات التنقّل الفرعي.
 */
class ShowPublicCategoryAction
{
    public function handle(string $locale, string $slug): JsonResponse
    {
        if (! in_array($locale, Category::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $payload = Cache::tags(['categories'])->remember(
            CacheKeys::publicCategoryDetail($locale, $slug),
            CacheTtl::METADATA,
            function () use ($locale, $slug): ?array {
                $category = Category::query()
                    ->active()
                    ->forLocale($locale)
                    ->where('slug', $slug)
                    ->with([
                        'children' => fn ($q) => $q->where('status', 'active')->orderBy('sort_order')->with('bannerMedia'),
                        'bannerMedia',
                    ])
                    ->first();

                if ($category === null) {
                    return null;
                }

                return (new PublicCategoryResource($category))->resolve();
            }
        );

        if ($payload === null) {
            return ApiResponse::error(__('category.not_found'), [], 404);
        }

        return ApiResponse::success(data: $payload);
    }
}
