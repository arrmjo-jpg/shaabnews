<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Enums\ArticleStatus;
use App\Enums\ArticleType;
use App\Enums\LiveEventStatus;
use App\Http\Resources\Admin\Content\ArticleResource;
use App\Models\Article;
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

class CreateArticleAction
{
    public function handle(array $validated, User $actor): JsonResponse
    {
        $type = ArticleType::from($validated['type']);
        $locale = $validated['locale'];
        $primaryId = (int) $validated['primary_category_id'];
        $secondary = $validated['secondary_category_ids'] ?? [];
        $requestedAuthorId = isset($validated['author_id']) ? (int) $validated['author_id'] : null;

        if ($denied = ArticleAuthorizationGuard::forCreate($actor, $type, $requestedAuthorId)) {
            return $denied;
        }

        if ($denied = ArticleCategoryGuard::check($type, $locale, $primaryId, $secondary)) {
            return $denied;
        }

        $authorId = ArticleAuthorizationGuard::resolveAuthorId($actor, $type, $requestedAuthorId);

        $contentJson = TipTapSanitizer::clean($validated['content_json']);
        $tags = $validated['tags'] ?? null;

        $article = DB::transaction(function () use ($validated, $actor, $authorId, $type, $locale, $primaryId, $secondary, $contentJson, $tags): Article {
            $article = new Article;
            $article->fill([
                'author_id' => $authorId,
                'primary_category_id' => $primaryId,
                'type' => $type->value,
                'status' => ArticleStatus::Draft->value, // إنشاء = مسودّة (الانتقالات في موجة سير العمل)
                // حالة الحدث المباشر — افتراضياً «مجدوَل» لمقالات live، وإلا null.
                'event_status' => $type === ArticleType::Live
                    ? ($validated['event_status'] ?? LiveEventStatus::Scheduled->value)
                    : null,
                'locale' => $locale,
                'title' => $validated['title'],
                'subtitle' => $validated['subtitle'] ?? null,
                'short_url' => $validated['short_url'] ?? null,
                'excerpt' => $validated['excerpt'] ?? null,
                'content_json' => $contentJson,
                'content' => TipTapRenderer::toHtml($contentJson), // عرض مشتقّ مُعقَّم
                'seo_title' => $validated['seo_title'] ?? null,
                'seo_description' => $validated['seo_description'] ?? null,
                'seo_keywords' => $validated['seo_keywords'] ?? null,
                'canonical_url' => $validated['canonical_url'] ?? null,
                'robots' => $validated['robots'] ?? null,
                'og_image_id' => $validated['og_image_id'] ?? null,
                'is_featured' => $validated['is_featured'] ?? false,
                'is_breaking' => $validated['is_breaking'] ?? false,
                'is_pinned' => $validated['is_pinned'] ?? false,
                'is_header' => $validated['is_header'] ?? false,
                'is_editor_pick' => $validated['is_editor_pick'] ?? false,
                'is_squares' => $validated['is_squares'] ?? false,
                // قرار مقفول: التعليقات معطّلة افتراضياً — تفعيل صريح فقط
                'comments_enabled' => $validated['comments_enabled'] ?? false,
                // عدّاد المشاهدات يُضبط يدوياً تحريرياً فقط؛ غيره يبدأ من صفر.
                'views_count' => ArticleAuthorizationGuard::isEditorial($actor)
                    ? (int) ($validated['views_count'] ?? 0)
                    : 0,
            ]);

            if (! empty($validated['slug'])) {
                $article->slug = $validated['slug'];
            }

            $article->save();

            if ($secondary !== []) {
                $article->categories()->sync($secondary);
            }

            if ($tags !== null) {
                $article->syncTags($tags);
            }

            // إسناد وسائط المكتبة المرحّلة (client-stage → attach-on-save)
            if (array_key_exists('media', $validated)) {
                MediaAttachmentSyncer::sync($article, $validated['media'] ?? []);
            }

            ArticleRevisionRecorder::snapshot($article, $actor->id);

            // تحديث الفهرس فوراً بعد إسناد العلاقات (categories/tags/media) للوقاية من تأخر مزامنة Pivot
            $article->searchable();

            return $article;
        });

        // إبطال حبيبي: feed لغته + تفاصيله + تصنيفاته (لا تفريغ شامل).
        Cache::tags(ArticleCacheTags::writeTags($article))->flush();
        ArticleCdnPurge::purge($article);

        return ApiResponse::success(
            __('article.created'),
            new ArticleResource(
                $article->load(['author:id,name', 'primaryCategory:id,name,slug', 'categories:id,name,slug', 'tags', 'mediaAssets', 'ogImage'])
            ),
            201
        );
    }
}
