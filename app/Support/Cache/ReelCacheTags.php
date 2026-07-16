<?php

declare(strict_types=1);

namespace App\Support\Cache;

use App\Models\Reel;

/**
 * وسوم كاش الريلز — مصدر الحقيقة الوحيد لاستراتيجية الإبطال الحبيبي (granular).
 *
 * بدلاً من تفريغ كل كاش الريلز عند أي تعديل (Cache::tags(['reels'])->flush())،
 * نوسم كل إدخال بوسوم دقيقة فيُبطَل أضيق نطاق ممكن:
 *
 *   ALL                  → مظلّة عامة تبقى على كل إدخال (لتفريغ شامل يدوي/صيانة).
 *   feed(locale)         → القوائم/المميَّز/الرائج للغة (تعتمد مجموعة المنشور فيها).
 *   detail(locale, slug) → تفاصيل ريل واحد. يُوسَم بالـ slug لأن مفتاح الكاش بالـ
 *                          slug؛ فلا يلزم استعلام إضافي على أكثر النقاط سخونة.
 *
 * قاعدة الإبطال عند كتابة ريل في لغة L:
 *   flush(detail(L, slug)) + flush(feed(L))  — ولا نلمس اللغات الأخرى.
 *   عند تغيّر الـ slug/اللغة: نُبطِل القديم والجديد معاً (يمنع تقديم محتوى قديم
 *   على رابط الـ slug القديم).
 *
 * يتطلّب مخزن كاش يدعم الوسوم (redis/memcached) — إلزامي في الإنتاج.
 */
final class ReelCacheTags
{
    /** المظلّة العامة — تبقى على كل إدخال لتمكين تفريغ شامل عند الحاجة. */
    public const ALL = 'reels';

    /** وسم قوائم/خلاصات لغة (list + featured + trending). */
    public static function feed(string $locale): string
    {
        return self::scheme()->feed($locale);
    }

    /** وسم تفاصيل ريل واحد (بالـ locale+slug — مطابق لمفتاح الكاش). */
    public static function detail(string $locale, string $slug): string
    {
        return self::scheme()->detail($locale, $slug);
    }

    private static function scheme(): CacheTagScheme
    {
        return new CacheTagScheme(self::ALL);
    }

    /**
     * وسوم إدخالات الخلاصات (قوائم/مميَّز/رائج) في لغة.
     *
     * @return array<int,string>
     */
    public static function feedTags(string $locale): array
    {
        return self::scheme()->feedTags($locale);
    }

    /**
     * وسوم إدخال تفاصيل ريل (مظلّة + تفاصيله فقط — بلا وسم الخلاصة عمداً).
     *
     * عدم وسم التفاصيل بـ feed(locale) هو ما يمنح العزل الحقيقي: كتابة ريل تُفرّغ
     * feed(locale) [للقوائم] + detail(هذا الريل] فقط؛ فتبقى تفاصيل بقية ريلز
     * اللغة سليمة. لو حملت التفاصيل وسم الخلاصة لأُبطِلت جميعها عند أي كتابة.
     *
     * @return array<int,string>
     */
    public static function detailTags(string $locale, string $slug): array
    {
        return self::scheme()->detailTags($locale, $slug);
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل ريل. يشمل خلاصة لغته الحالية
     * وتفاصيله؛ وعند تغيّر اللغة أو الـ slug يشمل القديم أيضاً (يمنع بقايا قديمة).
     *
     * @return array<int,string>
     */
    public static function invalidationTags(Reel $reel, ?string $oldLocale = null, ?string $oldSlug = null): array
    {
        return self::scheme()->invalidationTags(
            dimension: $reel->locale,
            slug: (string) $reel->slug,
            oldDimension: $oldLocale,
            oldSlug: $oldSlug,
        );
    }
}
