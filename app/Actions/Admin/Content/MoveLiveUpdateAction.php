<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\LiveUpdateResource;
use App\Models\Article;
use App\Models\ArticleLiveUpdate;
use App\Models\User;
use App\Support\Content\LiveUpdateGuard;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * نقل تحديث لأعلى/أسفل بتبديل موضعه مع الجار المباشر ضمن نفس مجموعة التثبيت
 * (المثبَّت لا يختلط بغير المثبَّت). آمن للخطوط الطويلة: يبدّل صفّين فقط.
 */
class MoveLiveUpdateAction
{
    public function handle(
        Article $article,
        ArticleLiveUpdate $update,
        string $direction,
        User $actor
    ): JsonResponse {
        if ($denied = LiveUpdateGuard::authorize($actor, $article)) {
            return $denied;
        }

        if ($update->article_id !== $article->id) {
            return ApiResponse::error(__('live_update.not_found'), [], 404);
        }

        // الجار المباشر داخل نفس مجموعة التثبيت (أعلى = موضع أكبر).
        $neighbor = ArticleLiveUpdate::query()
            ->where('article_id', $article->id)
            ->where('is_pinned', $update->is_pinned)
            ->when(
                $direction === 'up',
                fn ($q) => $q->where('position', '>', $update->position)->orderBy('position'),
                fn ($q) => $q->where('position', '<', $update->position)->orderByDesc('position'),
            )
            ->first();

        if ($neighbor === null) {
            // أصلاً في الطرف — لا تغيير.
            return ApiResponse::success(
                __('live_update.updated'),
                new LiveUpdateResource($update->load(['author:id,name', 'mediaAssets'])),
            );
        }

        DB::transaction(function () use ($update, $neighbor): void {
            [$a, $b] = [$update->position, $neighbor->position];
            $update->forceFill(['position' => $b])->save();
            $neighbor->forceFill(['position' => $a])->save();
        });

        Cache::tags(['live_updates'])->flush();
        FrontendRevalidate::tags(FrontendCacheTags::liveUpdates($article));

        return ApiResponse::success(
            __('live_update.updated'),
            new LiveUpdateResource($update->fresh()->load(['author:id,name', 'mediaAssets'])),
        );
    }
}
