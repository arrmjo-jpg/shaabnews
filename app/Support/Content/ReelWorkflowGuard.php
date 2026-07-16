<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\ReelStatus;
use App\Models\Reel;
use App\Models\User;
use App\Support\Content\Workflow\EditorialWorkflowGuard;
use App\Support\Content\Workflow\WorkflowDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * حارس انتقالات حالة الريل — غلاف رقيق فوق EditorialWorkflowGuard المشترك
 * (Task 6a). التوقيع العامّ لم يتغيّر. مثل الفيديو، الريل يملك بوّابة
 * صلاحيّة دقيقة (reels.publish/archive) — لكن فقط للنشر والأرشفة، لا
 * للجدولة (خلافاً للفيديو تحديداً — فرق حقيقيّ محفوظ كما هو، لا مُوحَّد).
 *
 * محتوى الكاتب لا يُنشَر تلقائياً أبداً. لا Policy (اتساق معماري معتمد).
 */
final class ReelWorkflowGuard
{
    private static function definition(): WorkflowDefinition
    {
        return new WorkflowDefinition(
            transitions: [
                'draft' => ['submitted', 'in_review', 'scheduled', 'published', 'archived'],
                'submitted' => ['in_review', 'scheduled', 'published', 'rejected'],
                'in_review' => ['scheduled', 'published', 'rejected', 'draft'],
                'scheduled' => ['published', 'draft', 'archived'],
                'published' => ['archived'],
                'rejected' => ['draft', 'submitted'],
                'archived' => ['draft'],
            ],
            writerAllowed: [
                'draft' => ['submitted'],
                'rejected' => ['submitted'],
            ],
            abilityForTarget: [
                'published' => 'reels.publish',
                'archived' => 'reels.archive',
            ],
            messages: [
                'invalid_transition' => 'reel.invalid_transition',
                'writer_cannot_edit_others' => 'reel.writer_cannot_edit_others',
                'writer_transition_forbidden' => 'reel.writer_transition_forbidden',
                'forbidden_transition' => 'reel.forbidden_transition',
                'schedule_requires_date' => 'reel.schedule_future',
            ],
        );
    }

    public static function check(
        User $actor,
        Reel $reel,
        ReelStatus $target,
        ?Carbon $scheduledAt
    ): ?JsonResponse {
        return EditorialWorkflowGuard::check(
            isEditorial: ReelAuthorizationGuard::isEditorial($actor),
            isOwner: $reel->author_id === $actor->id,
            from: $reel->status->value,
            to: $target->value,
            scheduledAt: $scheduledAt,
            definition: self::definition(),
            actor: $actor,
        );
    }
}
