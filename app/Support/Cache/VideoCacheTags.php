<?php

declare(strict_types=1);

namespace App\Support\Cache;

use App\Models\Video;
use App\Models\VideoPlaylist;

/**
 * وسوم كاش مكتبة الفيديو — مصدر الحقيقة للإبطال الحبيبي (granular). مرآة
 * ReelCacheTags مع إضافة وسمَي التصنيف وقائمة التشغيل (نطاق أوسع من الريلز).
 *
 *   ALL                    → مظلّة عامة على كل إدخال (تفريغ شامل/صيانة).
 *   feed(locale)           → خلاصات اللغة (قوائم/مميَّز/رائج).
 *   detail(locale, slug)   → تفاصيل فيديو واحد.
 *   category(locale, slug) → صفحة/قائمة تصنيف فيديو.
 *   playlist(locale, slug) → صفحة قائمة تشغيل.
 *   SITEMAP                → خرائط الفيديو (تُبطَل عند أي كتابة منشورة).
 *
 * يتطلّب مخزناً يدعم الوسوم (redis إنتاجاً) — إلزامي أصلاً (RedisProductionCheck).
 */
final class VideoCacheTags
{
    public const ALL = 'videos';

    public const SITEMAP = 'videos:sitemap';

    public static function feed(string $locale): string
    {
        return self::scheme()->feed($locale);
    }

    public static function detail(string $locale, string $slug): string
    {
        return self::scheme()->detail($locale, $slug);
    }

    public static function category(string $locale, string $categorySlug): string
    {
        return self::scheme()->category($locale, $categorySlug);
    }

    private static function scheme(): CacheTagScheme
    {
        return new CacheTagScheme(self::ALL, self::SITEMAP);
    }

    public static function playlist(string $locale, string $slug): string
    {
        return 'videos:playlist:'.$locale.':'.$slug;
    }

    /** @return array<int,string> وسوم إدخال خلاصة لغة. */
    public static function feedTags(string $locale): array
    {
        return self::scheme()->feedTags($locale);
    }

    /** @return array<int,string> وسوم إدخال تفاصيل فيديو (مظلّة + تفاصيله فقط). */
    public static function detailTags(string $locale, string $slug): array
    {
        return self::scheme()->detailTags($locale, $slug);
    }

    /** @return array<int,string> وسوم صفحة/قائمة تصنيف. */
    public static function categoryTags(string $locale, string $categorySlug): array
    {
        return self::scheme()->categoryTags($locale, $categorySlug);
    }

    /** @return array<int,string> وسوم صفحة قائمة تشغيل. */
    public static function playlistTags(string $locale, string $slug): array
    {
        return [self::ALL, self::playlist($locale, $slug)];
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل فيديو — feed لغته + تفاصيله + تصنيفه
     * + SITEMAP، وعند تغيّر اللغة/الـ slug يشمل القديم أيضاً (يمنع بقايا قديمة).
     *
     * @return array<int,string>
     */
    public static function invalidationTags(
        Video $video,
        ?string $oldLocale = null,
        ?string $oldSlug = null,
        ?string $categorySlug = null,
        ?string $oldCategorySlug = null,
    ): array {
        return self::scheme()->invalidationTags(
            dimension: $video->locale,
            slug: (string) $video->slug,
            categorySlugs: ($categorySlug !== null && $categorySlug !== '') ? [$categorySlug] : [],
            oldDimension: $oldLocale,
            oldSlug: $oldSlug,
            oldCategorySlugs: ($oldCategorySlug !== null && $oldCategorySlug !== '') ? [$oldCategorySlug] : [],
        );
    }

    /**
     * وسوم إبطال كتابة قائمة تشغيل — صفحتها + feed لغتها + SITEMAP، مع القديم
     * عند تغيّر slug/locale.
     *
     * @return array<int,string>
     */
    public static function playlistInvalidationTags(
        VideoPlaylist $playlist,
        ?string $oldLocale = null,
        ?string $oldSlug = null,
    ): array {
        $locale = $playlist->locale;
        $slug = (string) $playlist->slug;

        $tags = [self::SITEMAP, self::feed($locale), self::playlist($locale, $slug)];

        $oldLocale ??= $locale;
        $oldSlug ??= $slug;

        if ($oldLocale !== $locale || $oldSlug !== $slug) {
            $tags[] = self::playlist($oldLocale, $oldSlug);
        }

        return array_values(array_unique($tags));
    }
}
