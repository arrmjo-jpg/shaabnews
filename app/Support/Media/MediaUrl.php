<?php

declare(strict_types=1);

namespace App\Support\Media;

use Illuminate\Support\Facades\Storage;

/**
 * مصدر الحقيقة الوحيد لروابط الوسائط المحلّية (القرص public: الشعارات/الأيقونات/العلامة/صور الكُتّاب…).
 *
 * الأصل يأتي من `MEDIA_PUBLIC_URL` (دومين الـAPI الذي يخدم /storage) لا من APP_URL — لأنّ APP_URL
 * مضبوط على دومين الواجهة (Next.js)، فروابط APP_URL/storage تصل إلى الواجهة لا إلى لارافيل فتنكسر.
 *
 * الأصل مُهيّأ مرّة واحدة في قرص `public` (config/filesystems.php)، فكلّ `Storage::disk('public')->url()`
 * في التطبيق يخرج رابطًا مطلقًا صحيحًا تلقائيًّا. هذه الأداة غلاف null-safe مُعبِّر عن النيّة يُستعمَل عند
 * بناء روابط الوسائط صراحةً (بلا تكرار منطق «مسار ⇒ رابط أو null»).
 */
final class MediaUrl
{
    /** رابط عامّ مطلق لملفّ على القرص public، أو null حين لا مسار. */
    public static function forPublic(?string $path): ?string
    {
        return $path !== null && $path !== ''
            ? Storage::disk('public')->url($path)
            : null;
    }

    /**
     * أصل روابط الوسائط المحلّية (بلا «/storage» ولا شرطة نهائيّة) — للحالات النادرة التي تحتاج القاعدة فقط.
     * مشتقّ من إعداد القرص لا من env() ⇒ آمن مع `config:cache`.
     */
    public static function origin(): string
    {
        $url = (string) config('filesystems.disks.public.url'); // <origin>/storage
        $origin = preg_replace('#/storage/?$#', '', $url);

        return rtrim($origin ?? $url, '/');
    }
}
