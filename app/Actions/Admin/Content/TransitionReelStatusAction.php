<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Enums\ReelStatus;
use App\Events\Content\ReelStatusChanged;
use App\Http\Resources\Admin\Content\ReelResource;
use App\Models\Reel;
use App\Models\User;
use App\Support\Content\ReelRevisionRecorder;
use App\Support\Content\ReelWorkflowGuard;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * انتقال حالة الريل (يدوي محكوم بالصلاحيات). البوابة الخشنة reels.edit على
 * المسار؛ النشر/الأرشفة يتطلّبان صلاحية دقيقة إضافية تُفرَض هنا (لا policy منفصل).
 */
class TransitionReelStatusAction
{
    public function handle(Reel $reel, array $validated, User $actor): JsonResponse
    {
        $target = ReelStatus::from($validated['status']);

        $scheduledAt = ! empty($validated['published_at'])
            ? Carbon::parse($validated['published_at'])
            : null;

        // سير العمل (matrix + ملكية الكاتب + WRITER_ALLOWED + بوّابة النشر/الأرشفة
        // الدقيقة + الجدولة المستقبلية) — مصدر الحقيقة الوحيد للتفويض.
        if ($denied = ReelWorkflowGuard::check($actor, $reel, $target, $scheduledAt)) {
            return $denied;
        }

        // حظر صارم: لا نشر ولا جدولة لريل بلا فيديو جاهز (media ready).
        if (
            ($target === ReelStatus::Published || $target === ReelStatus::Scheduled)
            && ! $reel->hasPublishableMedia()
        ) {
            return ApiResponse::error(__('reel.media_not_ready'), [], 422);
        }

        $from = $reel->status;

        $reel = DB::transaction(function () use ($reel, $actor, $target, $scheduledAt): Reel {
            $reel->status = $target->value;

            if ($target === ReelStatus::Published) {
                $reel->published_at = $reel->published_at ?? now();
                $reel->published_by_id = $actor->id;
            } elseif ($target === ReelStatus::Scheduled) {
                $reel->published_at = $scheduledAt;
            }

            $reel->save();

            ReelRevisionRecorder::snapshot($reel, $actor->id);

            return $reel;
        });

        // حدث نطاقيّ (Task 6b، مرآة ADR-E2): يستبدل النداءات الأمريّة القائمة
        // (كاش/CDN/إشعار) بمستمعين متزامنين — نفس التوقيت والتسلسل تماماً.
        event(new ReelStatusChanged($reel, $from, $target, $actor));

        return ApiResponse::success(
            __('reel.status_changed'),
            new ReelResource($reel->fresh()->load(['author:id,name']))
        );
    }
}
