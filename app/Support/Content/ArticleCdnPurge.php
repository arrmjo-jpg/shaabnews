<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Article;
use App\Modules\CDN\Jobs\ProcessCdnPurgeBatch;
use App\Modules\CDN\Services\CloudflareClient;
use App\Modules\CDN\Support\CdnPurgeBuffer;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Seo\SearchEngineNotify;

/**
 * إبطال حافة الـ CDN عند كتابة مقال (إنشاء/تحديث/نشر/أرشفة/استرجاع/حذف/تغيّر slug).
 *
 * مرآة ReelCdnPurge: يكمّل الإبطال الحبيبي لكاش التطبيق (tag=articles) بإبطال نشِط
 * لحافة الـ CDN كي يَظهر الخبر العاجل فوراً دون انتظار s-maxage. لا يحجب الكتابة:
 * يُجمَّع في الـ buffer ويُنفَّذ عبر الطابور (ProcessCdnPurgeBatch) — fire-and-forget.
 *
 * بوابة مزدوجة: يُفعَّل فقط حين يكون الـ CDN مفعّلاً ومهيّأً وعلم cdn_auto_purge مُشغّلاً.
 *
 * تغطية الإبطال (لغة المقال — الواجهة العامة على نفس نطاق التطبيق):
 *   • صفحات الواجهة (SSR): canonical للمقال + /{locale}/articles + الرئيسية /{locale}
 *     + صفحات تصنيفاته (أساسي + ثانوية).
 *   • نقاط الـ API العامة (حاملة ترويسات الكاش): قائمة + تفاصيل بالـ slug + الرئيسية
 *     + خلاصة latest + تصنيفاته تحت /api/v1/{locale}.
 *   • عند تغيّر slug/locale: صفحة الـ canonical القديمة كذلك (منع بقايا قديمة).
 */
final class ArticleCdnPurge
{
    public static function purge(
        Article $article,
        ?string $oldPath = null,
        array $oldCategorySlugs = [],
        array $oldTags = [],
        ?int $oldAuthorId = null,
    ): void {
        rescue(static fn () => self::doPurge($article, $oldPath, $oldCategorySlugs, $oldTags, $oldAuthorId));
    }

    private static function doPurge(
        Article $article,
        ?string $oldPath = null,
        array $oldCategorySlugs = [],
        array $oldTags = [],
        ?int $oldAuthorId = null,
    ): void {
        // إخطار واجهة Next بإبطال الوسوم — مستقلّ عن إعداد الـ CDN أدناه (بوابته الخاصّة:
        // FRONTEND_REVALIDATE_URL/secret) ومُجدوَل ومعزول الفشل. يسبق بوابة الـ CDN عمداً.
        // السلَغ القديم يُشتقّ من oldPath (canonical = /{locale}/articles/{id}-{slug}) ليُبطَل وسمه أيضاً.
        $oldSlug = $oldPath !== null ? preg_replace('/^\d+-/', '', basename($oldPath)) : null;
        FrontendRevalidate::tags(FrontendCacheTags::article($article, $oldSlug, $oldCategorySlugs, $oldTags, $oldAuthorId));

        // إخطار محركات البحث بتحديث الخريطة عند تغيّر مقال منشور (بوابته SEARCH_PING_ENABLED).
        if ($article->status->value === 'published') {
            SearchEngineNotify::sitemaps();
        }

        $client = new CloudflareClient;

        if (! $client->enabled() || ! $client->settings()->cdn_auto_purge) {
            return;
        }

        $urls = self::urlsFor($article);

        if ($oldPath !== null && $oldPath !== $article->canonicalPath()) {
            $urls[] = PublicSeoBuilder::absoluteUrl($oldPath);
        }

        $urls = array_values(array_filter(array_unique($urls)));
        if ($urls === []) {
            return;
        }

        (new CdnPurgeBuffer)->add($urls);
        ProcessCdnPurgeBatch::dispatch()->afterCommit();
    }

    /**
     * مجموعة روابط الإبطال لمقال في لغته (صفحات الواجهة + نقاط الـ API + تصنيفاته).
     *
     * @return array<int,string>
     */
    private static function urlsFor(Article $article): array
    {
        $article->loadMissing(['primaryCategory:id,slug', 'categories:id,slug']);

        $locale = $article->locale;
        $slug = (string) $article->slug;
        $apiBase = 'api/v1/'.$locale;

        $urls = [
            // صفحات الواجهة العامة (SSR) — نفس النطاق.
            PublicSeoBuilder::absoluteUrl($article->canonicalPath()),
            PublicSeoBuilder::absoluteUrl($locale.'/articles'),
            PublicSeoBuilder::absoluteUrl($locale),
            // نقاط الـ API العامة — حاملة ترويسات s-maxage على الحافة.
            PublicSeoBuilder::absoluteUrl($apiBase.'/articles'),
            PublicSeoBuilder::absoluteUrl($apiBase.'/articles/'.$slug),
            PublicSeoBuilder::absoluteUrl($apiBase.'/homepage'),
            PublicSeoBuilder::absoluteUrl($apiBase.'/feed/latest'),
        ];

        // صفحات التصنيفات (أساسي + ثانوية) — واجهة + API.
        $categorySlugs = collect([$article->primaryCategory])
            ->merge($article->categories)
            ->filter()
            ->map(fn ($c): ?string => $c->slug)
            ->filter()
            ->unique();

        foreach ($categorySlugs as $catSlug) {
            $urls[] = PublicSeoBuilder::absoluteUrl($locale.'/categories/'.$catSlug);
            $urls[] = PublicSeoBuilder::absoluteUrl($apiBase.'/categories/'.$catSlug);
        }

        return $urls;
    }
}
