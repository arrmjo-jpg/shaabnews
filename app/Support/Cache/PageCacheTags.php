<?php

declare(strict_types=1);

namespace App\Support\Cache;

use App\Models\Page;

/**
 * وسوم كاش الصفحات الثابتة — مصدر الحقيقة الوحيد لاستراتيجية الإبطال الحبيبي.
 * مرآةٌ لـ ReelCacheTags:
 *
 *   ALL                  → مظلّة عامة على كل إدخال (تفريغ شامل يدوي/صيانة).
 *   feed(locale)         → قائمة الصفحات/التنقّل للغة (هيدر/تذييل).
 *   detail(locale, slug) → تفاصيل صفحة واحدة (مفتاح الكاش بالـ slug).
 *
 * قاعدة الإبطال عند كتابة صفحة في لغة L:
 *   flush(detail(L, slug)) + flush(feed(L)) — ولا نلمس اللغات الأخرى.
 *   عند تغيّر الـ slug/اللغة: نُبطِل القديم والجديد معاً.
 */
final class PageCacheTags
{
    /** المظلّة العامة — تبقى على كل إدخال لتمكين تفريغ شامل عند الحاجة. */
    public const ALL = 'pages';

    /** وسم قائمة/تنقّل لغة. */
    public static function feed(string $locale): string
    {
        return self::scheme()->feed($locale);
    }

    /** وسم تفاصيل صفحة واحدة (بالـ locale+slug — مطابق لمفتاح الكاش). */
    public static function detail(string $locale, string $slug): string
    {
        return self::scheme()->detail($locale, $slug);
    }

    private static function scheme(): CacheTagScheme
    {
        return new CacheTagScheme(self::ALL);
    }

    /**
     * وسوم إدخالات القائمة/التنقّل في لغة.
     *
     * @return array<int,string>
     */
    public static function feedTags(string $locale): array
    {
        return self::scheme()->feedTags($locale);
    }

    /**
     * وسوم إدخال تفاصيل صفحة (مظلّة + تفاصيلها فقط — بلا وسم القائمة عمداً، للعزل).
     *
     * @return array<int,string>
     */
    public static function detailTags(string $locale, string $slug): array
    {
        return self::scheme()->detailTags($locale, $slug);
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل صفحة. يشمل قائمة لغتها الحالية وتفاصيلها؛
     * وعند تغيّر اللغة أو الـ slug يشمل القديم أيضاً (يمنع بقايا قديمة).
     *
     * @return array<int,string>
     */
    public static function invalidationTags(Page $page, ?string $oldLocale = null, ?string $oldSlug = null): array
    {
        return self::scheme()->invalidationTags(
            dimension: $page->locale,
            slug: (string) $page->slug,
            oldDimension: $oldLocale,
            oldSlug: $oldSlug,
        );
    }
}
