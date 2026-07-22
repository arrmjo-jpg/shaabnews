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
 * تفاصيل مقال عام بالـ (locale + مُعرِّف وارد بأي شكل: id، أو id-slug، أو slug
 * قديم). فقط المقالات المنشورة (status=published وtime <= now).
 *
 * إصلاح جذريّ (2026-07-18): الكاش كان يُبنى بمفتاح/وسم من *النص الوارد كما هو*
 * (raw $slug) — فأي شكل رابط مختلف لنفس المقال (id مجرّد مقابل id-slug مقابل
 * slug) كان يُنشئ إدخال كاش منفصلاً لا يُبطِله أي تحديث لاحق (الإبطال يستهدف
 * دائماً وسم السلَغ الحقيقي فقط). الحل: **حُلّ الهوية (id) أولاً**، من مصدر
 * رخيص غير مُخزَّن (سطر واحد مفهرس)، ثم ابنِ مفتاح/وسم الكاش من الـ id المُحلَّل
 * حصراً — لا من أي نص وارد. هذا يضمن أن كل أشكال الرابط لنفس المقال تتشارك
 * بالضبط نفس إدخال الكاش، فيُبطَل بأي تحديث بصرف النظر عن الشكل المطلوب به.
 */
class ShowPublicArticleAction
{
    public function handle(string $locale, string $slug): JsonResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $id = $this->resolveId($locale, $slug);
        if ($id === null) {
            return $this->notFoundOrRedirect($locale, $slug);
        }

        $payload = CachedRead::remember(
            ArticleCacheTags::detailTags($locale, (string) $id),
            CacheKeys::publicArticleDetail($locale, (string) $id),
            CacheTtl::MEDIUM,
            function () use ($locale, $id): ?array {
                $article = Article::query()
                    ->published()
                    ->forLocale($locale)
                    ->where('id', $id)
                    ->with([
                        'author' => function ($query) {
                            $query->select('id', 'name', 'bio', 'avatar', 'is_writer')
                                ->withCount(['articles as articles_count' => fn ($q) => $q->published()]);
                        },
                        // parent_id: مطلوب لـ Category::canonicalPath() (مسار متداخل) عند بناء
                        // breadcrumbs في PublicSeoBuilder — بلا هذا العمود يُعامَل كل قسم كجذر.
                        'primaryCategory:id,name,slug,parent_id',
                        'categories:id,name,slug',
                        'tags',
                        'mediaAssets',
                    ])
                    ->first();

                if ($article === null) {
                    return null;
                }

                return (new PublicArticleResource($article))->resolve();
            }
        );

        if ($payload === null) {
            return $this->notFoundOrRedirect($locale, $slug);
        }

        // الاحتساب لا يتمّ هنا (الاستجابة قابلة للتخزين على الحافة): يُصدَر رمز منارة
        // موقّع، ويسجّل العميل المشاهدة عبر /engagement/article/{id}/view غير المُخزّنة.
        // TTL متمايز للحافة: تفاصيل حديثة (متوسّط-طويل) أو أرشيف (طويل) حسب عمر النشر.
        return ApiResponse::success(
            data: $payload,
            meta: ['view_token' => EngagementBeaconToken::issue('article', (int) $payload['id'])],
        )->header('Cache-Control', CdnTtl::forPublishedAt($payload['published_at'] ?? null));
    }

    /**
     * يحُلّ المُعرِّف الوارد (بأي شكل) إلى id عدديّ — بلا أي تخزين مؤقّت هنا
     * (استعلام مفهرس رخيص فقط للفرع الأخير)، تمهيداً لبناء مفتاح/وسم الكاش من
     * الـ id حصراً في handle(). لا يتحقّق من النشر/اللغة هنا عمداً — ذلك يبقى
     * مسؤولية الإغلاق المُخزَّن في handle() (فيُخزَّن id غير موجود/غير منشور
     * كنتيجة سلبية أيضاً، بنفس تصميم CachedRead الأصليّ لمنع عاصفة على الغياب).
     */
    private function resolveId(string $locale, string $slug): ?int
    {
        if (preg_match('/^(\d+)-/', $slug, $matches)) {
            return (int) $matches[1];
        }

        if (is_numeric($slug)) {
            return (int) $slug;
        }

        return Article::query()
            ->published()
            ->forLocale($locale)
            ->where('slug', $slug)
            ->value('id');
    }

    /** 404، أو 301 عبر ArticleRedirectResolver (article_url_history) لسلَغ قديم فعليّ. */
    private function notFoundOrRedirect(string $locale, string $slug): JsonResponse
    {
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
}
