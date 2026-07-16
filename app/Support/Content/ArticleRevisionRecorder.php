<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Article;
use App\Models\ArticleRevision;

/**
 * مُسجِّل لقطات المقال (أساس النُّسخ — ADR §4/Phase1).
 * يُستدعى صراحةً من الـ Action بعد كل كتابة (لا observer).
 * الوسوم خارج نطاق Wave C2 ⇒ tags_snapshot = null.
 */
final class ArticleRevisionRecorder
{
    public static function snapshot(Article $article, ?int $editorId): void
    {
        ArticleRevision::create([
            'article_id' => $article->id,
            'editor_id' => $editorId,
            'title' => $article->title,
            'excerpt' => $article->excerpt,
            'content_json' => $article->content_json, // المصدر القانوني (P4-D1)
            'content' => $article->content,           // عرض مشتقّ اختياري
            'seo_title' => $article->seo_title,
            'seo_description' => $article->seo_description,
            'seo_keywords' => $article->seo_keywords,
            'status_snapshot' => $article->status->value,
            'flags_snapshot' => [
                'is_featured' => $article->is_featured,
                'is_breaking' => $article->is_breaking,
                'is_header' => $article->is_header,
                'is_squares' => $article->is_squares,
                'comments_enabled' => $article->comments_enabled,
            ],
            'tags_snapshot' => $article->tags->pluck('name')->values()->all(),
        ]);
    }
}
