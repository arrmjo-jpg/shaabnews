<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Models\Article;
use App\Models\ArticleLiveUpdate;
use App\Models\User;
use App\Support\Content\LiveUpdateGuard;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DeleteLiveUpdateAction
{
    public function handle(Article $article, ArticleLiveUpdate $update, User $actor): JsonResponse
    {
        if ($denied = LiveUpdateGuard::authorize($actor, $article)) {
            return $denied;
        }

        if ($update->article_id !== $article->id) {
            return ApiResponse::error(__('live_update.not_found'), [], 404);
        }

        $update->delete();

        Cache::tags(['live_updates'])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::liveUpdates($article));

        return ApiResponse::success(__('live_update.deleted'));
    }
}
