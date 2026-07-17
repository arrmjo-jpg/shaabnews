<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Enums\BroadcastStatus;
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
 * إنشاء بثّ — يبدأ دائماً كمسودّة (draft). الانتقالات (مجدول/مباشر/…) محكومة لاحقاً
 * في B2. أمان المصدر مفروض هنا أيضاً (حدّ الـ Action) دفاعاً عميقاً ضدّ أي مستدعٍ
 * يتجاوز FormRequest. لا رفع/ترميز — مصدر خارجي موثوق فقط.
 */
class CreateBroadcastAction
{
    public function handle(array $validated, User $actor): JsonResponse
    {
        $sourceType = (string) ($validated['source_type'] ?? '');
        $sourceUrl = (string) ($validated['source_url'] ?? '');

        // ثابتة أمان المصدر عند حدّ الـ Action (لا يُعتمَد على FormRequest وحده).
        if (! BroadcastSourceValidator::isAllowed($sourceType, $sourceUrl)) {
            return ApiResponse::error(__('broadcast.source.unsupported'), [], 422);
        }

        $broadcast = new Broadcast;
        $broadcast->fill([
            'title' => $validated['title'],
            'excerpt' => $validated['excerpt'] ?? null,
            'description' => $validated['description'] ?? null,
            'kind' => $validated['kind'],
            'source_type' => $sourceType,
            'source_url' => $sourceUrl,
            'status' => BroadcastStatus::Draft->value, // محافظ: الانتقالات في B2
            'category_id' => $validated['category_id'] ?? null,
            'vod_video_id' => $validated['vod_video_id'] ?? null,
            'thumbnail_path' => $validated['thumbnail_path'] ?? null,
            'poster_path' => $validated['poster_path'] ?? null,
            'cover_media_id' => $validated['cover_media_id'] ?? null,
            'seo_title' => $validated['seo_title'] ?? null,
            'seo_description' => $validated['seo_description'] ?? null,
            'seo_keywords' => $validated['seo_keywords'] ?? null,
            'canonical_url' => $validated['canonical_url'] ?? null,
            'robots' => $validated['robots'] ?? null,
            'scheduled_at' => $validated['scheduled_at'] ?? null,
            'is_featured' => $validated['is_featured'] ?? false,
            'is_public' => $validated['is_public'] ?? false,
            'sort_order' => $validated['sort_order'] ?? 0,
            'meta' => $validated['meta'] ?? null,
            'created_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        if (! empty($validated['slug'])) {
            $broadcast->slug = $validated['slug'];
        }

        $broadcast->save();
        $broadcast->load(['category', 'creator', 'cover']);

        Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));

        return ApiResponse::success(
            __('broadcast.created'),
            new BroadcastResource($broadcast),
            201
        );
    }
}
