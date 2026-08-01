<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

/**
 * المالك الوحيد لأصل موقع ووردبريس المصدر (WP_BASE_URL) — مصدر الوسائط الأساسي.
 *
 * الوسائط تُنزَّل مباشرةً من الموقع الحيّ بدل اشتراط نسخة محلّية من
 * wp-content/uploads. تغيير النطاق = تغيير هذا الإعداد وحده (لا نطاق مكتوب في
 * الشيفرة، ولا مسار قرص مطلوب).
 *
 * إن غاب الإعداد ⇒ enabled() = false ويعود الخطّ كاملاً لسلوكه السابق
 * (حلّ محلّي من uploads_path) بلا أيّ تغيير — الوضع البعيد اشتراك صريح بالإعداد.
 */
final class WpMediaSource
{
    private const UPLOADS_SEGMENT = '/wp-content/uploads/';

    /** الأصل العامّ المُهيّأ (بلا شرطة ختامية)، أو null إن لم يُضبط. */
    public static function baseUrl(): ?string
    {
        $raw = trim((string) config('wp-migration.base_url', ''));
        if ($raw === '') {
            return null;
        }

        $base = rtrim($raw, '/');

        // نقبل الأصل فقط (scheme://host[:port]) — أيّ مسار زائد يُهمَل كي يبقى
        // بناء الرابط حتميّاً مهما أدخل المشغّل «https://x.com/» أو «https://x.com/blog».
        $scheme = strtolower((string) parse_url($base, PHP_URL_SCHEME));
        $host = (string) parse_url($base, PHP_URL_HOST);
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }

        $port = parse_url($base, PHP_URL_PORT);

        return $scheme.'://'.$host.($port !== null ? ':'.$port : '');
    }

    /** هل التنزيل البعيد هو المصدر الأساسي للوسائط؟ */
    public static function enabled(): bool
    {
        return self::baseUrl() !== null;
    }

    /**
     * يبني رابط ملف داخل uploads من مسار نسبيّ (مثل «2024/05/image.jpg»).
     *
     * كل مقطع يُرمَّز على حدة (rawurlencode) فتُعالَج الأسماء العربية/المسافات
     * بأمان، وتبقى الشرطات المائلة فواصل مسار حقيقية.
     */
    public static function uploadsUrl(string $relativePath): ?string
    {
        $base = self::baseUrl();
        $rel = ltrim(trim($relativePath), '/');
        if ($base === null || $rel === '') {
            return null;
        }

        // حارس الاجتياز (نظير حارس realpath في الوضع المحلّي): مرجع مثل
        // «../../wp-config.php» يجب ألّا يُبنى رابطاً إطلاقاً — الخادم البعيد قد
        // يُطبّع «..» فيخرج عن مجلّد uploads. نرفض أيّ مقطع اجتياز أو بايت صفري.
        $segments = explode('/', $rel);
        foreach ($segments as $segment) {
            if ($segment === '..' || str_contains($segment, "\0")) {
                return null;
            }
        }

        $encoded = implode('/', array_map(
            static fn (string $segment): string => rawurlencode($segment),
            explode('/', $rel),
        ));

        return $base.self::UPLOADS_SEGMENT.$encoded;
    }
}
