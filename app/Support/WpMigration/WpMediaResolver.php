<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

/**
 * يصنّف ويحلّ مرجع صورة من متن ووردبريس إلى مصدر آمن قابل للاستيراد.
 *
 * أمان المسار (قاعدة #2): الحلّ محصور داخل جذر uploads المُهيّأ — realpath +
 * تحقّق من البادئة يمنع اجتياز المسار (../). استدلال الأصل (قاعدة #2): يفضّل
 * الصورة الأصلية، ثم أكبر مشتقّ متاح، ثم المشتقّ المُشار إليه (الأصغر) أخيراً.
 * المراجع الخارجية تُعاد كـ external ليجلبها المستورد بأمان SSRF + حدود الشبكة.
 */
final class WpMediaResolver
{
    private const UPLOADS_MARKER = '/wp-content/uploads/';

    public function __construct(private readonly string $uploadsRoot) {}

    public function resolve(string $src): MediaResolution
    {
        $src = trim($src);
        if ($src === '') {
            return MediaResolution::unresolved('media_unresolved');
        }

        $path = parse_url($src, PHP_URL_PATH);
        $pos = is_string($path) ? stripos($path, self::UPLOADS_MARKER) : false;

        if ($pos !== false) {
            $rel = rawurldecode(ltrim(substr((string) $path, $pos + strlen(self::UPLOADS_MARKER)), '/'));

            return $this->resolveLocal($rel, $src);
        }

        // ليس مسار uploads → خارجي إن كان http(s) مطلقاً، وإلا متعذّر.
        $scheme = strtolower((string) parse_url($src, PHP_URL_SCHEME));
        if (in_array($scheme, ['http', 'https'], true)) {
            return MediaResolution::external($src);
        }

        return MediaResolution::unresolved('media_unresolved');
    }

    private function resolveLocal(string $rel, string $originalSrc): MediaResolution
    {
        $original = $this->stripSizeSuffix($rel);

        // 1) الأصلية.
        if (($p = $this->safePath($original)) !== null) {
            return MediaResolution::local($p);
        }

        // 2) أكبر مشتقّ متاح.
        if (($p = $this->largestDerivative($original)) !== null) {
            return MediaResolution::local($p);
        }

        // 3) المشتقّ المُشار إليه نفسه (الأصغر) كملاذ أخير.
        if ($rel !== $original && ($p = $this->safePath($rel)) !== null) {
            return MediaResolution::local($p);
        }

        // بديل صريح الاشتراك (config('wp-migration.allow_remote_media_fallback'),
        // افتراضياً false): لا ملف محلي مطلقاً بعد المحاولات الثلاث أعلاه — بدل ترك
        // المرجع معلّقاً، أعِد الرابط الأصلي كـ external ليجلبه WpMediaImporter عبر
        // مساره الآمن من SSRF الموجود أصلاً (SafeUrl + حدود حجم/مهلة/mime/تحويلات).
        if (config('wp-migration.allow_remote_media_fallback', false)) {
            $scheme = strtolower((string) parse_url($originalSrc, PHP_URL_SCHEME));
            if (in_array($scheme, ['http', 'https'], true)) {
                return MediaResolution::external($originalSrc);
            }
        }

        return MediaResolution::unresolved('media_unresolved');
    }

    /** يزيل لاحقة الحجم (-768x512) أو -scaled من اسم الملف. */
    private function stripSizeSuffix(string $rel): string
    {
        $dir = str_contains($rel, '/') ? substr($rel, 0, (int) strrpos($rel, '/') + 1) : '';
        $base = basename($rel);
        $base = preg_replace('/-(?:\d+x\d+|scaled)(\.[A-Za-z0-9]+)$/', '$1', $base) ?? $base;

        return $dir.$base;
    }

    /** يبني مساراً مطلقاً آمناً داخل الجذر، أو null عند التعذّر/الاجتياز. */
    private function safePath(string $rel): ?string
    {
        if ($rel === '' || str_contains($rel, "\0")) {
            return null;
        }

        $root = realpath($this->uploadsRoot);
        if ($root === false) {
            return null;
        }

        $abs = rtrim($this->uploadsRoot, '/\\').DIRECTORY_SEPARATOR
            .str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rel);
        $real = realpath($abs);
        if ($real === false || ! is_file($real)) {
            return null;
        }

        // الحارس: المسار الحقيقي داخل الجذر فقط (يمنع ../).
        if ($real !== $root && ! str_starts_with($real, $root.DIRECTORY_SEPARATOR)) {
            return null;
        }

        return $real;
    }

    /** أكبر مشتقّ (name-WxH.ext) لنفس الأصل، ضمن الجذر فقط. */
    private function largestDerivative(string $originalRel): ?string
    {
        $root = realpath($this->uploadsRoot);
        if ($root === false) {
            return null;
        }

        $base = basename($originalRel);
        $dot = strrpos($base, '.');
        if ($dot === false) {
            return null;
        }
        $name = substr($base, 0, $dot);
        $ext = substr($base, $dot);

        $dirRel = str_contains($originalRel, '/') ? substr($originalRel, 0, (int) strrpos($originalRel, '/')) : '';
        $dirAbs = $root.($dirRel !== '' ? DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $dirRel) : '');
        $dirReal = realpath($dirAbs);
        if ($dirReal === false || ($dirReal !== $root && ! str_starts_with($dirReal, $root.DIRECTORY_SEPARATOR))) {
            return null;
        }

        $best = null;
        $bestArea = -1;
        $pattern = $dirReal.DIRECTORY_SEPARATOR.$name.'-*x*'.$ext;
        foreach (glob($pattern) ?: [] as $file) {
            if (! is_file($file)) {
                continue;
            }
            if (preg_match('/-(\d+)x(\d+)'.preg_quote($ext, '/').'$/', basename($file), $m) === 1) {
                $area = (int) $m[1] * (int) $m[2];
                if ($area > $bestArea) {
                    $bestArea = $area;
                    $best = $file;
                }
            }
        }

        return $best;
    }
}
