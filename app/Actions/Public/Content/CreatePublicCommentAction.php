<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Enums\CommentStatus;
use App\Models\Article;
use App\Models\Comment;
use App\Support\Content\CommentGuard;
use App\Support\Engagement\EngagementActor;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * إنشاء تعليق/رد عام — يفرض العقد (عالميّ ∧ مقال)، يصنّف الفاعل (مُصادَق→user_id،
 * زائر→اسم/بريد)، يتحقّق من الأب عند الرد (نفس المقال + أعلى-مستوى + معتمَد)، ويُنشئ
 * بحالة **pending** (لا يظهر قبل اعتماد الإشراف). تصفية بوت صامتة. الاستجابة no-store.
 */
class CreatePublicCommentAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(string $locale, string $slug, array $data, Request $request): JsonResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return self::noStore(ApiResponse::error(__('article.invalid_locale'), [], 422));
        }

        $article = Article::query()
            ->published()
            ->forLocale($locale)
            ->where(function ($query) use ($slug) {
                if (is_numeric($slug)) {
                    $query->where('id', (int) $slug);
                } elseif (preg_match('/^(\d+)-(.*)$/', $slug, $matches)) {
                    $query->where('id', (int) $matches[1]);
                } else {
                    $query->where('slug', $slug);
                }
            })
            ->first(['id', 'slug', 'locale', 'comments_enabled']);

        if ($article === null) {
            return self::noStore(ApiResponse::error(__('article.not_found'), [], 404));
        }

        if (! CommentGuard::enabledFor($article)) {
            return self::noStore(ApiResponse::error(__('comment.disabled'), [], 403));
        }

        $actor = EngagementActor::fromRequest($request);

        // بوت: قبول صامت بلا تخزين (مرآة CastVoteAction — لا تسريب، لا سجلّ).
        if ($actor->isBot) {
            return self::noStore(ApiResponse::success(__('comment.received'), ['accepted' => false]));
        }

        // المسار العام بلا auth:sanctum والـguard الافتراضيّ web (session) لا يحلّ Bearer،
        // فنحلّ المستخدم الاختياريّ عبر guard sanctum صراحةً (مسجّل → user_id؛ زائر → null).
        $user = $request->user('sanctum');

        $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
        if ($parentId !== null && ! $this->parentIsValid($parentId, $article)) {
            return self::noStore(ApiResponse::error(__('comment.invalid_parent'), [], 422));
        }

        Comment::create([
            'commentable_type' => $article->getMorphClass(),
            'commentable_id' => $article->id,
            'user_id' => $user?->id,
            'parent_id' => $parentId,
            'author_name' => $user === null ? ($data['author_name'] ?? null) : null,
            'author_email' => $user === null ? ($data['author_email'] ?? null) : null,
            'body' => (string) $data['body'],
            'status' => CommentStatus::Pending->value,
        ]);

        return self::noStore(ApiResponse::success(__('comment.received'), [
            'accepted' => true,
            'status' => CommentStatus::Pending->value,
        ]));
    }

    /** الرد صالح إن أشار لتعليق أعلى-مستوى معتمَد على نفس المقال (تعشيش مستوى واحد). */
    private function parentIsValid(int $parentId, Article $article): bool
    {
        return Comment::query()
            ->whereKey($parentId)
            ->where('commentable_type', $article->getMorphClass())
            ->where('commentable_id', $article->id)
            ->whereNull('parent_id')
            ->where('status', CommentStatus::Approved->value)
            ->exists();
    }

    private static function noStore(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'no-store, max-age=0');
    }
}
