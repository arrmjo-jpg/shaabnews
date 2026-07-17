<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Models\Category;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * تطبيق جماعي آمن لحقول الحالة/الظهور على عدّة تصنيفات دفعةً واحدة. يحدّث كل
 * نموذج على حِدة (يحفظ سجلّ التدقيق) — حقول محدودة فقط، لا لمسّ للهرمية أو اللغة.
 */
class BulkUpdateCategoriesAction
{
    /** الحقول المسموح بتعديلها جماعياً. */
    private const ALLOWED = ['status', 'show_in_header', 'show_in_body', 'show_in_footer'];

    /**
     * @param  array<int,int>  $ids
     * @param  array<string,mixed>  $fields
     */
    public function handle(array $ids, array $fields): JsonResponse
    {
        $changes = array_intersect_key($fields, array_flip(self::ALLOWED));
        if ($changes === []) {
            return ApiResponse::error(__('category.bulk_no_fields'), [], 422);
        }

        $categories = Category::query()->whereIn('id', $ids)->get();

        foreach ($categories as $category) {
            foreach ($changes as $field => $value) {
                $category->{$field} = $value;
            }
            $category->save();
        }

        Cache::tags(['categories'])->flush();

        // P1 (Cache Invalidation Audit): كانت هذه العملية الجماعية تُفرِّغ الكاش الخلفي فقط
        // دون إخطار الواجهة — كل تصنيف متأثّر يُعامَل كتحديث فرديّ (نفس نمط UpdateCategoryAction).
        $tags = $categories
            ->flatMap(fn (Category $category): array => FrontendCacheTags::category($category))
            ->unique()
            ->values()
            ->all();
        FrontendRevalidate::tags($tags);

        return ApiResponse::success(
            __('category.bulk_updated', ['count' => $categories->count()]),
            ['updated' => $categories->count()],
        );
    }
}
