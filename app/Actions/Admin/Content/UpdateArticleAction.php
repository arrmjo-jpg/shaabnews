<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Enums\ArticleType;
use App\Http\Resources\Admin\Content\ArticleResource;
use App\Models\Article;
use App\Models\ArticleUrlHistory;
use App\Models\User;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Content\ArticleAuthorizationGuard;
use App\Support\Content\ArticleCategoryGuard;
use App\Support\Content\ArticleCdnPurge;
use App\Support\Content\ArticleRevisionRecorder;
use App\Support\Content\MediaAttachmentSyncer;
use App\Support\Content\TipTapRenderer;
use App\Support\Content\TipTapSanitizer;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Wave C2: لا انتقالات حالة (status/published_at غير مقبولة).
 * يلتقط تاريخ المسار القانوني (ADR A4) عند تغيّر slug أو التصنيف الرئيسي.
 */
class UpdateArticleAction
{
    public function handle(Article $article, array $validated, User $actor): JsonResponse
    {
        $newType = array_key_exists('type', $validated)
            ? ArticleType::from($validated['type'])
            : null;

        if ($denied = ArticleAuthorizationGuard::forUpdate($actor, $article, $newType)) {
            return $denied;
        }

        $effectiveType = $newType ?? $article->type;
        $locale = $validated['locale'] ?? $article->locale;
        $primaryId = array_key_exists('primary_category_id', $validated)
            ? (int) $validated['primary_category_id']
            : $article->primary_category_id;

        $secondaryProvided = array_key_exists('secondary_category_ids', $validated);
        $secondary = $secondaryProvided
            ? ($validated['secondary_category_ids'] ?? [])
            : $article->categories()->pluck('categories.id')->all();

        if ($denied = ArticleCategoryGuard::check($effectiveType, $locale, $primaryId, $secondary)) {
            return $denied;
        }

        $oldPath = $article->canonicalPath();
        $oldLocale = $article->locale;
        $oldSlug = (string) $article->slug;
        $oldAuthorId = $article->author_id;
        $oldTags = $article->tags->pluck('name')->all();

        // slugs التصنيفات قبل التعديل — للإبطال الحبيبي الدقيق عند تغيّر العضوية.
        $oldCategorySlugs = collect([$article->primaryCategory])
            ->merge($article->categories)
            ->filter()->map(fn ($c): ?string => $c->slug)->filter()->unique()->values()->all();

        $article = DB::transaction(function () use (
            $article, $validated, $actor, $primaryId, $secondaryProvided, $secondary, $oldPath, $oldLocale
        ): Article {
            foreach ([
                'type', 'event_status', 'locale', 'title', 'subtitle', 'short_url', 'excerpt',
                'seo_title', 'seo_description', 'seo_keywords',
                'canonical_url', 'robots', 'og_image_id', 'is_featured', 'is_breaking',
                'is_pinned', 'is_header', 'is_editor_pick', 'is_squares', 'comments_enabled',
            ] as $field) {
                if (array_key_exists($field, $validated)) {
                    $article->{$field} = $validated[$field];
                }
            }

            // عدّاد المشاهدات قابل للتعديل اليدوي تحريرياً فقط.
            if (array_key_exists('views_count', $validated)
                && ArticleAuthorizationGuard::isEditorial($actor)) {
                $article->views_count = (int) $validated['views_count'];
            }

            // P4-D1: content_json هو المصدر؛ content عرض مشتقّ مُعقَّم
            if (array_key_exists('content_json', $validated)) {
                $clean = TipTapSanitizer::clean($validated['content_json']);
                $article->content_json = $clean;
                $article->content = TipTapRenderer::toHtml($clean);
            }

            if (array_key_exists('primary_category_id', $validated)) {
                $article->primary_category_id = $primaryId;
            }

            if (! empty($validated['slug'])) {
                $article->slug = $validated['slug'];
            }

            $article->save();

            if ($secondaryProvided) {
                $article->categories()->sync($secondary);
            }

            if (array_key_exists('tags', $validated)) {
                $article->syncTags($validated['tags'] ?? []);
            }

            // إسناد الوسائط: وجود المفتاح = مزامنة كاملة (attach-on-save)
            if (array_key_exists('media', $validated)) {
                MediaAttachmentSyncer::sync($article, $validated['media'] ?? []);
            }

            // ADR A4 — التقاط المسار القانوني القديم عند تغيّره
            $newPath = $article->fresh()->canonicalPath();
            if ($newPath !== $oldPath) {
                ArticleUrlHistory::firstOrCreate(
                    ['locale' => $oldLocale, 'old_path' => $oldPath],
                    ['article_id' => $article->id, 'reason' => 'canonical_change']
                );
            }

            ArticleRevisionRecorder::snapshot($article, $actor->id);

            // تحديث الفهرس فوراً بعد إسناد العلاقات (categories/tags/media) للوقاية من تأخر مزامنة Pivot
            $article->searchable();

            return $article;
        });

        // إبطال حبيبي: feed الحالي/القديم + تفاصيل الحالي/القديم + تصنيفات الحالي/القديم.
        Cache::tags(
            ArticleCacheTags::writeTags($article->fresh(), $oldLocale, $oldSlug, $oldCategorySlugs)
        )->flush();
        ArticleCdnPurge::purge($article, $oldPath, $oldCategorySlugs, $oldTags, $oldAuthorId);

        return ApiResponse::success(
            __('article.updated'),
            new ArticleResource(
                $article->fresh()->load(['author:id,name', 'primaryCategory:id,name,slug', 'categories:id,name,slug', 'tags', 'mediaAssets', 'ogImage'])
            )
        );
    }
}
