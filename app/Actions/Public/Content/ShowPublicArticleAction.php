<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Http\Resources\Public\Content\PublicArticleResource;
use App\Models\Article;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CachedRead;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Content\ArticleRedirectResolver;
use App\Support\Content\CdnTtl;
use App\Support\Engagement\EngagementBeaconToken;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * تفاصيل مقال عام بالـ (locale + slug). فقط المقالات المنشورة (status=published
 * وtime <= now). الكاش بمفتاح ثنائي (locale, slug) ضمن tag «articles».
 */
class ShowPublicArticleAction
{
    public function handle(string $locale, string $slug): JsonResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $payload = CachedRead::remember(
            ArticleCacheTags::detailTags($locale, $slug),
            CacheKeys::publicArticleDetail($locale, $slug),
            CacheTtl::MEDIUM,
            function () use ($locale, $slug): ?array {
                if (preg_match('/^(\d+)-(.*)$/', $slug, $matches)) {
                    $id = (int) $matches[1];
                    $article = Article::query()
                        ->published()
                        ->forLocale($locale)
                        ->where('id', $id)
                        ->with([
                            'author' => function ($query) {
                                $query->select('id', 'name', 'bio', 'avatar', 'is_writer')
                                    ->withCount(['articles as articles_count' => fn ($q) => $q->published()]);
                            },
                            'primaryCategory:id,name,slug',
                            'categories:id,name,slug',
                            'tags',
                            'mediaAssets',
                        ])
                        ->first();
                } elseif (is_numeric($slug)) {
                    $article = Article::query()
                        ->published()
                        ->forLocale($locale)
                        ->where('id', (int) $slug)
                        ->with([
                            'author' => function ($query) {
                                $query->select('id', 'name', 'bio', 'avatar', 'is_writer')
                                    ->withCount(['articles as articles_count' => fn ($q) => $q->published()]);
                            },
                            'primaryCategory:id,name,slug',
                            'categories:id,name,slug',
                            'tags',
                            'mediaAssets',
                        ])
                        ->first();
                } else {
                    $article = Article::query()
                        ->published()
                        ->forLocale($locale)
                        ->where('slug', $slug)
                        ->with([
                            'author' => function ($query) {
                                $query->select('id', 'name', 'bio', 'avatar', 'is_writer')
                                    ->withCount(['articles as articles_count' => fn ($q) => $q->published()]);
                            },
                            'primaryCategory:id,name,slug',
                            'categories:id,name,slug',
                            'tags',
                            'mediaAssets',
                        ])
                        ->first();
                }

                if ($article === null) {
                    return null;
                }

                return (new PublicArticleResource($article))->resolve();
            }
        );

        if ($payload === null) {
            // SEO: slug/locale قديم → 301 إلى رابط المقال الحالي (منع حلقة مضمون).
            $target = ArticleRedirectResolver::resolveBySlug($locale, $slug);
            if ($target !== null) {
                $location = url("/api/v1/{$target->locale}/articles/{$target->slug}");

                return new JsonResponse(
                    ['redirect' => $location],
                    301,
                    ['Location' => $location]
                );
            }

            return ApiResponse::error(__('article.not_found'), [], 404);
        }

        // الاحتساب لا يتمّ هنا (الاستجابة قابلة للتخزين على الحافة): يُصدَر رمز منارة
        // موقّع، ويسجّل العميل المشاهدة عبر /engagement/article/{id}/view غير المُخزّنة.
        // TTL متمايز للحافة: تفاصيل حديثة (متوسّط-طويل) أو أرشيف (طويل) حسب عمر النشر.
        return ApiResponse::success(
            data: $payload,
            meta: ['view_token' => EngagementBeaconToken::issue('article', (int) $payload['id'])],
        )->header('Cache-Control', CdnTtl::forPublishedAt($payload['published_at'] ?? null));
    }
}
