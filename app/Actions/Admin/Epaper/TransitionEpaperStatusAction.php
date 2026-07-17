<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Enums\EpaperStatus;
use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Models\Epaper;
use App\Models\User;
use App\Support\Epaper\EpaperSearchIndexer;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * انتقال حالة العدد. صلاحية الانتقال محسومة بالنوع (publish/archive). النشر/الجدولة
 * يتطلّبان وجود ملف PDF؛ الجدولة تتطلّب تاريخاً مستقبلياً. published_at يخدم الجدولة
 * (مستقبليّ) والنشر (الآن/ماضٍ). التدقيق تلقائيّ عبر AuditsChanges (status/published_at).
 */
class TransitionEpaperStatusAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(Epaper $epaper, array $data, User $actor): JsonResponse
    {
        $target = EpaperStatus::from((string) $data['status']);

        $ability = match ($target) {
            EpaperStatus::Published, EpaperStatus::Scheduled => 'epapers.publish',
            EpaperStatus::Archived => 'epapers.archive',
            EpaperStatus::Draft => null,
        };
        if ($ability !== null && ! $actor->can($ability)) {
            return ApiResponse::error(__('epaper.forbidden_transition'), [], 403);
        }

        // النشر/الجدولة على عدد بلا PDF غير ممكن.
        if (($target === EpaperStatus::Published || $target === EpaperStatus::Scheduled)
            && $epaper->media_asset_id === null) {
            return ApiResponse::error(__('epaper.media_required'), [], 422);
        }

        $scheduledAt = ! empty($data['published_at']) ? Carbon::parse((string) $data['published_at']) : null;
        if ($target === EpaperStatus::Scheduled && ($scheduledAt === null || $scheduledAt->isPast())) {
            return ApiResponse::error(
                __('epaper.schedule_requires_future_date'),
                ['published_at' => [__('epaper.schedule_requires_future_date')]],
                422,
            );
        }

        $epaper->status = $target->value;
        match ($target) {
            EpaperStatus::Published => $epaper->forceFill([
                'published_at' => $epaper->published_at ?? now(),
                'published_by_id' => $actor->id,
            ]),
            EpaperStatus::Scheduled => $epaper->forceFill(['published_at' => $scheduledAt]),
            EpaperStatus::Draft => $epaper->forceFill(['published_at' => null, 'published_by_id' => null]),
            EpaperStatus::Archived => $epaper, // يحتفظ بـ published_at
        };
        $epaper->save();

        // الحالة تحكم الظهور في الأرشيف ⇒ زامِن فهرس البحث (نشر=فهرسة، إلغاء/أرشفة=تطهير).
        EpaperSearchIndexer::queueSync($epaper->id);

        // الحالة تحكم الظهور في الواجهة العامة (Draft/Archived لا يظهران، Published يظهر) ⇒ أبطل كاش الواجهة.
        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper));

        return ApiResponse::success(
            __('epaper.status_changed'),
            new EpaperResource($epaper->fresh()->load(['mediaAsset', 'author'])),
        );
    }
}
