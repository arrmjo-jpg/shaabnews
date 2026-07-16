<?php

declare(strict_types=1);

namespace App\Support\Content\Workflow;

use App\Models\User;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * محرّك سير العمل التحريريّ العامّ (Phase 1, Task 6a) — لا يعرف شيئاً عن
 * Article/Video/Reel، فقط قيمًا بدائيّة + WorkflowDefinition. كلّ نوع
 * محتوى يحسب isEditorial/isOwner بمنطقه الخاصّ (غير مكرَّر هنا) ويُفوِّض
 * لهذا المحرّك — استُخرِج من 3 حرّاس شبه متطابقين حرفياً
 * (Article/Video/ReelWorkflowGuard)، لا افتراضًا مسبقًا.
 *
 * قاعدة "الجدولة تتطلّب تاريخاً مستقبلياً" ثابتة هنا عمداً (غير قابلة
 * للتهيئة) — شبه-كونيّة عبر كلّ هذه الأنواع اليوم، لا حاجة لجعلها بيانات.
 */
final class EditorialWorkflowGuard
{
    public static function check(
        bool $isEditorial,
        bool $isOwner,
        string $from,
        string $to,
        ?Carbon $scheduledAt,
        WorkflowDefinition $definition,
        User $actor,
    ): ?JsonResponse {
        if ($from === $to) {
            return ApiResponse::error(__($definition->messages['invalid_transition']), [], 422);
        }

        if (! in_array($to, $definition->transitions[$from] ?? [], true)) {
            return ApiResponse::error(__($definition->messages['invalid_transition']), [], 422);
        }

        if (! $isEditorial) {
            if (! $isOwner) {
                return ApiResponse::error(__($definition->messages['writer_cannot_edit_others']), [], 403);
            }

            if (! in_array($to, $definition->writerAllowed[$from] ?? [], true)) {
                return ApiResponse::error(__($definition->messages['writer_transition_forbidden']), [], 403);
            }
        } else {
            $ability = $definition->abilityForTarget[$to] ?? null;

            if ($ability !== null && ! $actor->can($ability)) {
                return ApiResponse::error(__($definition->messages['forbidden_transition']), [], 403);
            }
        }

        if ($to === 'scheduled') {
            if ($scheduledAt === null || $scheduledAt->isPast()) {
                return ApiResponse::error(__($definition->messages['schedule_requires_date']), [], 422);
            }
        }

        return null;
    }
}
