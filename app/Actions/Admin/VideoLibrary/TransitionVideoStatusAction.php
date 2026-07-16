<?php

declare(strict_types=1);

namespace App\Actions\Admin\VideoLibrary;

use App\Enums\VideoStatus;
use App\Events\Content\VideoStatusChanged;
use App\Http\Resources\Admin\VideoLibrary\VideoResource;
use App\Models\User;
use App\Models\Video;
use App\Support\Content\VideoWorkflowGuard;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * انتقال حالة الفيديو (يدوي محكوم بالصلاحيات). البوابة الخشنة videos.edit على
 * المسار؛ النشر يتطلّب videos.publish والأرشفة videos.archive (يُفرَضان هنا).
 *
 * **حارس الجاهزية يُطبَّق فقط عند النشر/الجدولة** — المسودّة لا تتطلّب وسائط
 * جاهزة للتشغيل، أمّا Published/Scheduled فيُرفَضان إن لم تكن الوسائط جاهزة.
 */
class TransitionVideoStatusAction
{
    public function handle(Video $video, array $validated, User $actor): JsonResponse
    {
        $target = VideoStatus::from($validated['status']);

        $scheduledAt = ! empty($validated['published_at'])
            ? Carbon::parse($validated['published_at'])
            : null;

        // سير العمل (matrix + ملكية الكاتب + WRITER_ALLOWED + بوّابة النشر/الجدولة/
        // الأرشفة الدقيقة + الجدولة المستقبلية) — مصدر الحقيقة الوحيد للتفويض.
        if ($denied = VideoWorkflowGuard::check($actor, $video, $target, $scheduledAt)) {
            return $denied;
        }

        // الجاهزية تُفرَض هنا فقط (لا على المسودّة): لا نشر/جدولة لفيديو غير جاهز.
        if (
            ($target === VideoStatus::Published || $target === VideoStatus::Scheduled)
            && ! $video->hasPublishableMedia()
        ) {
            return ApiResponse::error(__('video.media_not_ready'), [], 422);
        }

        $from = $video->status;

        $video = DB::transaction(function () use ($video, $actor, $target, $scheduledAt): Video {
            $video->status = $target->value;

            if ($target === VideoStatus::Published) {
                $video->published_at = $video->published_at ?? now();
                $video->published_by_id = $actor->id;
            } elseif ($target === VideoStatus::Scheduled) {
                $video->published_at = $scheduledAt;
            }

            $video->save();

            return $video;
        });

        // حدث نطاقيّ (Task 6b، مرآة ADR-E2): يستبدل النداءات الأمريّة القائمة
        // (كاش/تجديد الواجهة/إشعار) بمستمعين متزامنين — نفس التوقيت والتسلسل تماماً.
        event(new VideoStatusChanged($video, $from, $target, $actor));

        return ApiResponse::success(
            __('video.status_changed'),
            new VideoResource($video->fresh()->load(['author:id,name', 'mediaAsset', 'category']))
        );
    }
}
