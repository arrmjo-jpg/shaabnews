<?php

declare(strict_types=1);

namespace App\Support\Cache;

use App\Models\Article;

/**
 * وسوم كاش المقالات — مصدر الحقيقة لاستراتيجية الإبطال الحبيبي (granular).
 *
 * يستبدل التفريغ الشامل العابر للّغات (Cache::tags(['articles'])->flush()) بوسوم
 * دقيقة تُبطِل أضيق نطاق ممكن:
 *
 *   ALL                     → مظلّة عامة على كل إدخال (تفريغ شامل يدوي/صيانة).
 *   feed(locale)            → المجاميع التي تعكس «مجموعة منشورات اللغة» عموماً:
 *                             الرئيسية + latest + القوائم غير المفلترة + العاجل.
 *   detail(locale, slug)    → تفاصيل مقال واحد (مفتاح الكاش بالـ slug).
 *   category(locale, slug)  → صفحة تصنيف + القوائم المفلترة بهذا التصنيف.
 *
 * قاعدة الإبطال عند كتابة مقال في لغة L بتصنيفات C:
 *   flush(feed(L)) + flush(detail(L, slug)) + flush(category(L, c) ∀c∈C)
 *   ولا نلمس اللغات الأخرى ولا تفاصيل مقالات أخرى ولا تصنيفات غير متأثّرة.
 *   عند تغيّر slug/locale/التصنيفات: نُبطِل القديم أيضاً (يمنع بقايا قديمة).
 *
 * يتطلّب مخزن كاش يدعم الوسوم (redis) — إلزامي إنتاجاً (RedisProductionCheck).
 */
final class ArticleCacheTags
{
    /** المظلّة العامة — تبقى على كل إدخال لتمكين تفريغ شامل عند الحاجة. */
    public const ALL = 'articles';

    /** وسم خرائط الموقع (sitemaps) — يُبطَل عند أي كتابة مقال (تُعاد توليدها رخيصاً). */
    public const SITEMAP = 'articles:sitemap';

    /** وسم المجاميع العامة للّغة (الرئيسية + latest + القوائم + العاجل). */
    public static function feed(string $locale): string
    {
        return self::scheme()->feed($locale);
    }

    /** وسم تفاصيل مقال واحد (locale+slug — مطابق لمفتاح الكاش). */
    public static function detail(string $locale, string $slug): string
    {
        return self::scheme()->detail($locale, $slug);
    }

    /** وسم صفحة/قائمة تصنيف (locale+category-slug). */
    public static function category(string $locale, string $categorySlug): string
    {
        return self::scheme()->category($locale, $categorySlug);
    }

    private static function scheme(): CacheTagScheme
    {
        return new CacheTagScheme(self::ALL, self::SITEMAP);
    }

    /**
     * وسوم إدخالات المجاميع العامة (رئيسية/latest/قوائم/عاجل) في لغة.
     *
     * @return array<int,string>
     */
    public static function feedTags(string $locale): array
    {
        return self::scheme()->feedTags($locale);
    }

    /**
     * وسوم إدخال تفاصيل مقال (مظلّة + تفاصيله فقط — بلا وسم feed عمداً، لتحقيق
     * العزل: كتابة مقال تُبطِل feed(locale) والتفاصيل الخاصّة به فقط، فتبقى تفاصيل
     * بقية مقالات اللغة سليمة).
     *
     * @return array<int,string>
     */
    public static function detailTags(string $locale, string $slug): array
    {
        return self::scheme()->detailTags($locale, $slug);
    }

    /**
     * وسوم صفحة/قائمة تصنيف — وسم التصنيف فقط (بلا feed(locale)) لتحقيق العزل:
     * تُبطَل قائمة التصنيف عند تغيّر مقالات هذا التصنيف فقط، لا عند أي كتابة في
     * اللغة. كتابة مقال في التصنيف تشمل وسمه (writeTags) فيُبطَل بدقّة.
     *
     * @return array<int,string>
     */
    public static function categoryTags(string $locale, string $categorySlug): array
    {
        return self::scheme()->categoryTags($locale, $categorySlug);
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل مقال — feed لغته + تفاصيله + تصنيفاته،
     * وعند تغيّر اللغة/الـ slug/التصنيفات يشمل القديم أيضاً.
     *
     * @param  array<int,string>  $categorySlugs  تصنيفات المقال الحالية (slugs)
     * @param  array<int,string>  $oldCategorySlugs  تصنيفات قديمة (عند تغيّرها)
     * @return array<int,string>
     */
    public static function writeTags(
        Article $article,
        ?string $oldLocale = null,
        ?string $oldSlug = null,
        array $oldCategorySlugs = [],
    ): array {
        $article->loadMissing(['primaryCategory:id,slug', 'categories:id,slug']);

        $slugs = collect([$article->primaryCategory])
            ->merge($article->categories)
            ->filter()
            ->map(fn ($c): ?string => $c->slug)
            ->filter()
            ->unique()
            ->values()
            ->all();

        return self::invalidationTags($article, $oldLocale, $oldSlug, $slugs, $oldCategorySlugs);
    }

    public static function invalidationTags(
        Article $article,
        ?string $oldLocale = null,
        ?string $oldSlug = null,
        array $categorySlugs = [],
        array $oldCategorySlugs = [],
    ): array {
        return self::scheme()->invalidationTags(
            dimension: $article->locale,
            slug: (string) $article->slug,
            categorySlugs: $categorySlugs,
            oldDimension: $oldLocale,
            oldSlug: $oldSlug,
            oldCategorySlugs: $oldCategorySlugs,
        );
    }
}
