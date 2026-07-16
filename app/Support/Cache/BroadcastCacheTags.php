<?php

declare(strict_types=1);

namespace App\Support\Cache;

use App\Models\Broadcast;

/**
 * وسوم كاش البثّ — مصدر الحقيقة للإبطال الحبيبي (granular). مرآة VideoCacheTags مع
 * استبدال بُعد اللغة بـ kind (live|tv|radio) الذي يقسّم المسارات العامة.
 *
 *   ALL                  → مظلّة عامة على كل إدخال (تفريغ شامل/صيانة).
 *   feed(kind)           → خلاصة نوع (قوائم /live · /tv · /radio).
 *   detail(slug)         → صفحة بثّ واحدة.
 *   category(slug)       → صفحة/قائمة تصنيف بثّ.
 *   SITEMAP              → خرائط البثّ (تُبطَل عند أي كتابة منشورة).
 *
 * يتطلّب مخزناً يدعم الوسوم (redis إنتاجاً — إلزامي عبر RedisProductionCheck).
 */
final class BroadcastCacheTags
{
    public const ALL = 'broadcasts';

    public const SITEMAP = 'broadcasts:sitemap';

    public static function feed(string $kind): string
    {
        return self::scheme()->feed($kind);
    }

    public static function detail(string $slug): string
    {
        return self::scheme()->detail('', $slug);
    }

    public static function category(string $categorySlug): string
    {
        return self::scheme()->category('', $categorySlug);
    }

    private static function scheme(): CacheTagScheme
    {
        return new CacheTagScheme(self::ALL, self::SITEMAP, detailDimensioned: false, categoryDimensioned: false);
    }

    /** @return array<int,string> وسوم إدخال خلاصة نوع. */
    public static function feedTags(string $kind): array
    {
        return self::scheme()->feedTags($kind);
    }

    /** @return array<int,string> وسوم إدخال تفاصيل بثّ (مظلّة + تفاصيله فقط). */
    public static function detailTags(string $slug): array
    {
        return self::scheme()->detailTags('', $slug);
    }

    /** @return array<int,string> وسوم صفحة/قائمة تصنيف. */
    public static function categoryTags(string $categorySlug): array
    {
        return self::scheme()->categoryTags('', $categorySlug);
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل بثّ — feed نوعه + تفاصيله + تصنيفه +
     * SITEMAP، وعند تغيّر النوع/الـ slug/التصنيف يشمل القديم أيضاً (يمنع بقايا قديمة).
     *
     * @return array<int,string>
     */
    public static function invalidationTags(
        Broadcast $broadcast,
        ?string $oldKind = null,
        ?string $oldSlug = null,
        ?string $categorySlug = null,
        ?string $oldCategorySlug = null,
    ): array {
        return self::scheme()->invalidationTags(
            dimension: $broadcast->kind->value,
            slug: (string) $broadcast->slug,
            categorySlugs: ($categorySlug !== null && $categorySlug !== '') ? [$categorySlug] : [],
            oldDimension: $oldKind,
            oldSlug: $oldSlug,
            oldCategorySlugs: ($oldCategorySlug !== null && $oldCategorySlug !== '') ? [$oldCategorySlug] : [],
        );
    }
}
