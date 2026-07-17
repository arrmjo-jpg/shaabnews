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

class UpdateLiveUpdateAction
{
    public function handle(
        Article $article,
        ArticleLiveUpdate $update,
        array $validated,
        User $actor
    ): JsonResponse {
        if ($denied = LiveUpdateGuard::authorize($actor, $article)) {
            return $denied;
        }

        // ضمان أن التحديث يخصّ المقال المستهدَف (تطابق المسار)
        if ($update->article_id !== $article->id) {
            return ApiResponse::error(__('live_update.not_found'), [], 404);
        }

        if (array_key_exists('title', $validated)) {
            $update->title = $validated['title'];
        }

        if (array_key_exists('content_json', $validated)) {
            $clean = TipTapSanitizer::clean($validated['content_json']);
            $update->content_json = $clean;
            $update->content = TipTapRenderer::toHtml($clean);
        }

        if (array_key_exists('is_pinned', $validated)) {
            $update->is_pinned = (bool) $validated['is_pinned'];
        }

        if (array_key_exists('is_breaking', $validated)) {
            $update->is_breaking = (bool) $validated['is_breaking'];
        }

        if (array_key_exists('is_featured', $validated)) {
            $update->is_featured = (bool) $validated['is_featured'];
        }

        if (array_key_exists('happened_at', $validated) && ! empty($validated['happened_at'])) {
            $update->happened_at = Carbon::parse($validated['happened_at']);
        }

        $update->save();

        if (array_key_exists('media', $validated)) {
            MediaAttachmentSyncer::sync($update, $validated['media'] ?? []);
        }

        Cache::tags(['live_updates'])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::liveUpdates($article));

        return ApiResponse::success(
            __('live_update.updated'),
            new LiveUpdateResource($update->fresh()->load(['author:id,name', 'mediaAssets']))
        );
    }
}
