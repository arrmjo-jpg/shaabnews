<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Http\Resources\Admin\Broadcast\BroadcastResource;
use App\Models\Broadcast;
use App\Models\User;
use App\Support\Broadcast\BroadcastSourceValidator;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * تعديل بثّ (بيانات وصفية + المصدر). لا يُغيّر الحالة (الانتقالات منفصلة — B2).
 * إن تغيّر المصدر (النوع/الرابط) يُعاد التحقّق من أمانه عند حدّ الـ Action. إبطال
 * حبيبي يشمل القديم (kind/slug/تصنيف) لمنع بقايا الكاش.
 */
class UpdateBroadcastAction
{
    public function handle(Broadcast $broadcast, array $validated, User $actor): JsonResponse
    {
        $oldKind = $broadcast->kind->value;
        $oldSlug = (string) $broadcast->slug;
        $oldCategorySlug = $broadcast->category?->slug;

        // ثابتة أمان المصدر عند تغيّر النوع و/أو الرابط (حدّ الـ Action).
        if (array_key_exists('source_url', $validated) || array_key_exists('source_type', $validated)) {
            $sourceType = (string) ($validated['source_type'] ?? $broadcast->source_type->value);
            $sourceUrl = (string) ($validated['source_url'] ?? $broadcast->source_url);
            if (! BroadcastSourceValidator::isAllowed($sourceType, $sourceUrl)) {
                return ApiResponse::error(__('broadcast.source.unsupported'), [], 422);
            }
        }

        foreach ([
            'title', 'excerpt', 'description', 'kind', 'source_type', 'source_url',
            'category_id', 'vod_video_id', 'thumbnail_path', 'poster_path', 'cover_media_id', 'scheduled_at', 'sort_order', 'meta',
            'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $broadcast->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('is_featured', $validated)) {
            $broadcast->is_featured = (bool) $validated['is_featured'];
        }
        if (array_key_exists('is_public', $validated)) {
            $broadcast->is_public = (bool) $validated['is_public'];
        }
        if (array_key_exists('slug', $validated) && ! empty($validated['slug'])) {
            $broadcast->slug = $validated['slug'];
        }

        $broadcast->updated_by = $actor->id;
        $broadcast->save();
        $broadcast->refresh()->load(['category', 'creator', 'cover']);

        Cache::tags(BroadcastCacheTags::invalidationTags(
            $broadcast,
            oldKind: $oldKind,
            oldSlug: $oldSlug,
            categorySlug: $broadcast->category?->slug,
            oldCategorySlug: $oldCategorySlug,
        ))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast, oldKind: $oldKind, oldSlug: $oldSlug));

        return ApiResponse::success(
            __('broadcast.updated'),
            new BroadcastResource($broadcast)
        );
    }
}
