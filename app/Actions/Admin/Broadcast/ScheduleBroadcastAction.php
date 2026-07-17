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
 * جدولة بثّ (draft → scheduled). الانتقال محكوم بآلة الحالة. لا تشغيل بثّ —
 * يضبط الحالة وموعد البدء فقط (الأتمتة في B2.4 تنقله لاحقاً إلى live).
 */
class ScheduleBroadcastAction
{
    public function handle(Broadcast $broadcast, string $scheduledAt, ?User $actor = null): JsonResponse
    {
        if ($denied = BroadcastTransitionGuard::check($broadcast->status, BroadcastStatus::Scheduled)) {
            return $denied;
        }

        $broadcast->status = BroadcastStatus::Scheduled->value;
        $broadcast->scheduled_at = $scheduledAt;
        if ($actor !== null) {
            $broadcast->updated_by = $actor->id;
        }
        $broadcast->save();

        $broadcast->loadMissing('category');
        Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
        FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));

        return ApiResponse::success(
            __('broadcast.scheduled'),
            new BroadcastResource($broadcast->load('creator'))
        );
    }
}
