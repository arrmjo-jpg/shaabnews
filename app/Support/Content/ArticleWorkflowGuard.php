<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\ArticleStatus;
use App\Models\Article;
use App\Models\User;
use App\Support\Content\Workflow\EditorialWorkflowGuard;
use App\Support\Content\Workflow\WorkflowDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * حارس انتقالات حالة المقال — غلاف رقيق فوق EditorialWorkflowGuard المشترك
 * (Task 6a). التوقيع العامّ لم يتغيّر؛ القيم التجاريّة (جدول الانتقالات،
 * صلاحيّات الكاتب) هي بيانات هذا النوع فقط. لا بوّابة صلاحيّة دقيقة إضافيّة
 * للمقال (abilityForTarget فارغ) — خلافاً لِـ Video/ReelWorkflowGuard.
 *
 * محتوى الكاتب لا يُنشَر تلقائياً أبداً. نمط مطابق لـ ArticleAuthorizationGuard — لا Policy.
 */
final class ArticleWorkflowGuard
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
            abilityForTarget: [],
            messages: [
                'invalid_transition' => 'article.invalid_transition',
                'writer_cannot_edit_others' => 'article.writer_cannot_edit_others',
                'writer_transition_forbidden' => 'article.writer_transition_forbidden',
                'schedule_requires_date' => 'article.schedule_requires_future_date',
            ],
        );
    }

    public static function check(
        User $actor,
        Article $article,
        ArticleStatus $target,
        ?Carbon $scheduledAt
    ): ?JsonResponse {
        return EditorialWorkflowGuard::check(
            isEditorial: ArticleAuthorizationGuard::isEditorial($actor),
            isOwner: $article->author_id === $actor->id,
            from: $article->status->value,
            to: $target->value,
            scheduledAt: $scheduledAt,
            definition: self::definition(),
            actor: $actor,
        );
    }
}
