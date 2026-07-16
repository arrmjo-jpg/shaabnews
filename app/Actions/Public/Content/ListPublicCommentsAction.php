<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Enums\CommentStatus;
use App\Http\Resources\Public\Content\PublicCommentResource;
use App\Models\Article;
use App\Models\Comment;
use App\Support\Content\CommentGuard;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * قائمة التعليقات العامة لمقال — أعلى-مستوى **معتمَد فقط**، مرقّمة، أحدث أولاً، مع
 * ردودها المعتمَدة (تعشيش مستوى واحد). تُطبَّق بوّابة العرض (عالميّ ∧ مقال): عند
 * الإطفاء تُعاد قائمة فارغة دون كشف وجود تعليقات.
 */
class ListPublicCommentsAction
{
    private const MAX_PER_PAGE = 50;

    public function handle(string $locale, string $slug, Request $request): JsonResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
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
            return ApiResponse::error(__('article.not_found'), [], 404);
        }

        if (! CommentGuard::enabledFor($article)) {
            return ApiResponse::success(data: [], meta: ['pagination' => self::emptyPagination()]);
        }

        $default = (int) config('performance.pagination.default');
        $perPage = max(1, min(self::MAX_PER_PAGE, (int) $request->integer('per_page', $default)));

        $paginator = Comment::query()
            ->where('commentable_type', $article->getMorphClass())
            ->where('commentable_id', $article->id)
            ->whereNull('parent_id')
            ->where('status', CommentStatus::Approved->value)
            ->with([
                'user:id,name',
                'replies' => fn ($q) => $q
                    ->where('status', CommentStatus::Approved->value)
                    ->with('user:id,name')
                    ->oldest(),
            ])
            ->latest()
            ->paginate($perPage)
            ->appends($request->query());

        return ApiResponse::success(
            data: PublicCommentResource::collection($paginator)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $paginator->total(),
                    'count' => $paginator->count(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
            ],
        );
    }

    /** @return array<string,int> */
    private static function emptyPagination(): array
    {
        return ['total' => 0, 'count' => 0, 'per_page' => 0, 'current_page' => 1, 'total_pages' => 1];
    }
}
