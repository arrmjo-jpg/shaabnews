<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\VideoStatus;
use App\Models\User;
use App\Models\Video;
use App\Support\Content\Workflow\EditorialWorkflowGuard;
use App\Support\Content\Workflow\WorkflowDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * حارس انتقالات حالة الفيديو — غلاف رقيق فوق EditorialWorkflowGuard المشترك
 * (Task 6a). التوقيع العامّ لم يتغيّر. خلافاً للمقال، الفيديو يملك بوّابة
 * صلاحيّة دقيقة إضافيّة للتحريريّين (videos.publish/archive) — مُمثَّلة
 * كبيانات في abilityForTarget، لا كفرع منطقيّ.
 *
 * محتوى الكاتب لا يُنشَر تلقائياً أبداً. لا Policy (اتساق معماري معتمد).
 */
final class VideoWorkflowGuard
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
                'published' => 'videos.publish',
                'scheduled' => 'videos.publish',
                'archived' => 'videos.archive',
            ],
            messages: [
                'invalid_transition' => 'video.invalid_transition',
                'writer_cannot_edit_others' => 'video.writer_cannot_edit_others',
                'writer_transition_forbidden' => 'video.writer_transition_forbidden',
                'forbidden_transition' => 'video.forbidden_transition',
                'schedule_requires_date' => 'video.schedule_requires_date',
            ],
        );
    }

    public static function check(
        User $actor,
        Video $video,
        VideoStatus $target,
        ?Carbon $scheduledAt
    ): ?JsonResponse {
        return EditorialWorkflowGuard::check(
            isEditorial: VideoAuthorizationGuard::isEditorial($actor),
            isOwner: $video->author_id === $actor->id,
            from: $video->status->value,
            to: $target->value,
            scheduledAt: $scheduledAt,
            definition: self::definition(),
            actor: $actor,
        );
    }
}
