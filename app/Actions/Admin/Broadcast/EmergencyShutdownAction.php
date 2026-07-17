<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Enums\BroadcastStatus;
use App\Http\Resources\Admin\Broadcast\BroadcastResource;
use App\Models\Broadcast;
use App\Models\User;
use App\Support\Audit\BroadcastModerationAudit;
use App\Support\Broadcast\BroadcastPresence;
use App\Support\Broadcast\BroadcastPresenceControl;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * الإيقاف الطارئ — زرّ الذعر. آمنٌ لدورة الحياة (B2)، ثلاثة أفعال:
 *   1) تعليق تشغيليّ: live → offline متى كان الانتقال شرعياً (canTransitionTo)؛ وإلا
 *      (مجدول/متوقّف/منتهٍ/مسودة...) يُتجاوَز التعليق دون كسر آلة الحالة.
 *   2) إغلاق الجمهور — يبقى نافذاً حتى إعادة فتحٍ صريحة (أمان: حتى لو استُؤنف لاحقاً).
 *   3) تفكيك الحضور فوراً (تصفير العدّ) + أثر تدقيق دائم بالفاعل.
 *
 * تعاونيّ بالكامل: لا قطع بايت على البثّ الخارجي — العملاء يفكّون ارتباطهم عبر حالة
 * النبضة (offline ثم closed بعد أي استئناف).
 */
class EmergencyShutdownAction
{
    public function handle(Broadcast $broadcast, ?User $actor = null): JsonResponse
    {
        $previousStatus = $broadcast->status->value;
        $tookOffline = false;

        // 1) تعليق تشغيليّ — فقط متى كان الانتقال إلى offline شرعياً (يحترم آلة B2).
        if ($broadcast->status->canTransitionTo(BroadcastStatus::Offline)) {
            $broadcast->status = BroadcastStatus::Offline->value;
            if ($actor !== null) {
                $broadcast->updated_by = $actor->id;
            }
            $broadcast->save();
            $broadcast->loadMissing('category');
            Cache::tags(BroadcastCacheTags::invalidationTags($broadcast, categorySlug: $broadcast->category?->slug))->flush();
            FrontendRevalidate::tags(FrontendCacheTags::broadcast($broadcast));
            $tookOffline = true;
        }

        // 2) إغلاق الجمهور + 3) تفكيك الحضور.
        BroadcastPresenceControl::close($broadcast->id);
        BroadcastPresence::reset($broadcast->id);

        BroadcastModerationAudit::log('emergency_shutdown', $actor, $broadcast, [
            'previous_status' => $previousStatus,
            'took_offline' => $tookOffline,
        ]);

        return ApiResponse::success(
            __('broadcast.moderation.emergency_shutdown'),
            new BroadcastResource($broadcast->load('creator', 'category')),
        );
    }
}
