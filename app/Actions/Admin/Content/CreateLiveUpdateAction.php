<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\LiveUpdateResource;
use App\Models\Article;
use App\Models\ArticleLiveUpdate;
use App\Models\User;
use App\Support\Content\LiveUpdateGuard;
use App\Support\Content\MediaAttachmentSyncer;
use App\Support\Content\TipTapRenderer;
use App\Support\Content\TipTapSanitizer;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class CreateLiveUpdateAction
{
    public function handle(Article $article, array $validated, User $actor): JsonResponse
    {
        if ($denied = LiveUpdateGuard::authorize($actor, $article)) {
            return $denied;
        }

        $clean = TipTapSanitizer::clean($validated['content_json']);

        // موضع جديد أعلى الخط: أكبر موضع حالي + 1 (الأحدث في القمّة افتراضياً).
        $nextPosition = ((int) ArticleLiveUpdate::query()
            ->where('article_id', $article->id)
            ->max('position')) + 1;

        $update = ArticleLiveUpdate::create([
            'article_id' => $article->id,
            'author_id' => $actor->id,
            'title' => $validated['title'] ?? null,
            'content_json' => $clean,
            'content' => TipTapRenderer::toHtml($clean),
            'is_pinned' => $validated['is_pinned'] ?? false,
            'is_breaking' => $validated['is_breaking'] ?? false,
            'is_featured' => $validated['is_featured'] ?? false,
            'position' => $nextPosition,
            'happened_at' => ! empty($validated['happened_at'])
                ? Carbon::parse($validated['happened_at'])
                : now(),
        ]);

        if (array_key_exists('media', $validated)) {
            MediaAttachmentSyncer::sync($update, $validated['media'] ?? []);
        }

        // P8: تفريغ كاش التغطية الحيّة العامة (يُملأ في P8.3)
        Cache::tags(['live_updates'])->flush();
        // P0 (Cache Invalidation Audit): إخطار الواجهة فورًا — بدون هذا كانت صفحة المقال
        // المباشر تبقى قديمة حتى revalidate=1800 (نصف ساعة) رغم التحديث الحقيقي.
        FrontendRevalidate::tags(FrontendCacheTags::liveUpdates($article));

        return ApiResponse::success(
            __('live_update.created'),
            new LiveUpdateResource($update->load(['author:id,name', 'mediaAssets'])),
            201
        );
    }
}
