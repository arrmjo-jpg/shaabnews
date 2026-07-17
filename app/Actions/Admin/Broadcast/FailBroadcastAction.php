<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Enums\BroadcastStatus;
use App\Http\Resources\Admin\Broadcast\BroadcastResource;
use App\Models\Broadcast;
use App\Models\User;
use App\Support\Broadcast\BroadcastTransitionGuard;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * وسم البثّ كفاشل (scheduled|live|offline → failed) — يدوي هنا؛ الاكتشاف الآلي
 * لصحّة المصدر (وملء سبب الفشل) يأتي في B3. سبب اختياري يُخزَّن كلقطة.
 */
class FailBroadcastAction
{
    public function handle(Broadcast $broadcast, ?string $reason = null, ?User $actor = null): JsonResponse
    {
        if ($denied = BroadcastTransitionGuard::check($broadcast->status, BroadcastStatus::Failed)) {
            return $denied;
        }

        $broadcast->status = BroadcastStatus::Failed->value;
        if ($reason !== null && $reason !== '') {
            $broadcast->last_health_message = mb_substr($reason, 0, 500);
        }
        if ($actor !== null) {
            $broadcast->updated_by = $actor->id;
        }
        $broadcast->save();

        $broadcast->loadMissing('category');
        Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));

        return ApiResponse::success(
            __('broadcast.failed'),
            new BroadcastResource($broadcast->load('creator'))
        );
    }
}
