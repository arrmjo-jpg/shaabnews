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
 * تفاصيل تصنيف فعّال للقراءة العامة بالـ (locale + مسار متداخل بالـ slug).
 * الأبناء مُحمَّلون للاستهلاك في صفحات التنقّل الفرعي.
 *
 * إعادة تصميم (2026-07-18): يقبل $path سلسلة مقاطع مفصولة بـ«/» (مسار
 * /news/category/{...} الجديد) بدل slug مفرد — يمشي المسار من الجذر نزولاً
 * (كل مقطع يجب أن يطابق ابناً مباشراً للمقطع السابق)، ويُخفق فوراً عند أول
 * انقطاع في السلسلة (لا مطابقة جزئية زائفة). عمق أقصى Category::MAX_DEPTH.
 */
class ShowPublicCategoryAction
{
    public function handle(string $locale, string $path): JsonResponse
    {
        if (! in_array($locale, Category::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $segments = array_values(array_filter(explode('/', trim($path, '/')), fn (string $s): bool => $s !== ''));
        if ($segments === [] || count($segments) > Category::MAX_DEPTH) {
            return ApiResponse::error(__('category.not_found'), [], 404);
        }

        $payload = Cache::tags(['categories'])->remember(
            CacheKeys::publicCategoryDetail($locale, implode('/', $segments)),
            CacheTtl::METADATA,
            function () use ($locale, $segments): ?array {
                $category = $this->resolveChain($locale, $segments);
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

    /**
     * يمشي سلسلة المقاطع من الجذر نزولاً — كل مقطع لاحق يجب أن يكون ابناً
     * مباشراً لسابقه. أي انقطاع (مقطع لا يطابق ابناً) ⇒ null (404) فوراً،
     * بلا تراجع لمطابقة جزئية.
     *
     * @param  array<int,string>  $segments
     */
    private function resolveChain(string $locale, array $segments): ?Category
    {
        $withChildren = fn ($q) => $q->where('status', 'active')
            ->orderBy('sort_order')
            ->with('bannerMedia');

        $current = Category::query()
            ->active()
            ->forLocale($locale)
            ->whereNull('parent_id')
            ->where('slug', $segments[0])
            ->with(['children' => $withChildren, 'bannerMedia'])
            ->first();

        if ($current === null) {
            return null;
        }

        for ($i = 1; $i < count($segments); $i++) {
            $current = Category::query()
                ->active()
                ->forLocale($locale)
                ->where('parent_id', $current->id)
                ->where('slug', $segments[$i])
                ->with(['children' => $withChildren, 'bannerMedia'])
                ->first();

            if ($current === null) {
                return null;
            }
        }

        return $current;
    }
}
