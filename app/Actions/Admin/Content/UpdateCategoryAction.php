<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\CategoryResource;
use App\Models\Category;
use App\Support\Content\CategoryHierarchyGuard;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class UpdateCategoryAction
{
    public function handle(Category $category, array $validated): JsonResponse
    {
        $oldSlug = (string) $category->slug; // قبل أيّ تعديل — لإبطال وسم السلَغ القديم عند تغييره

        $locale = $validated['locale'] ?? $category->locale;
        $parentId = array_key_exists('parent_id', $validated)
            ? $validated['parent_id']
            : $category->parent_id;

        // اتساق اللغة مع الأبناء عند تغيير اللغة (ADR A3.4)
        if (
            array_key_exists('locale', $validated)
            && $validated['locale'] !== $category->locale
            && $category->children()->where('locale', '!=', $validated['locale'])->exists()
        ) {
            return ApiResponse::error(__('category.locale_children_mismatch'), [], 422);
        }

        if ($denied = CategoryHierarchyGuard::check($category, $parentId, $locale)) {
            return $denied;
        }

        foreach (['name', 'description', 'icon', 'scope', 'status', 'show_in_header',
            'show_in_body', 'show_in_footer', 'sort_order', 'locale',
            'banner_media_id', 'show_title', 'layout_type', 'appearance',
            'provider', 'external_id'] as $field) {
            if (array_key_exists($field, $validated)) {
                $category->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('parent_id', $validated)) {
            $category->parent_id = $validated['parent_id'];
        }

        if (! empty($validated['slug'])) {
            $category->slug = $validated['slug'];
        }

        $category->save();

        Cache::tags(['categories'])->flush();
        // إبطال الواجهة: الشجرة + تنقّل الهيدر + قوائم القسم (+ السلَغ القديم ومظلّة المقالات عند تغييره).
        FrontendRevalidate::tags(FrontendCacheTags::category($category, $oldSlug));

        return ApiResponse::success(
            __('category.updated'),
            new CategoryResource($category->fresh()->load('bannerMedia'))
        );
    }
}
