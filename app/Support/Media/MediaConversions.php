<?php

declare(strict_types=1);

namespace App\Support\Media;

use App\Models\MediaAsset;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Imagick;
use RuntimeException;
use Spatie\Image\Enums\Fit;
use Spatie\Image\Image;

/**
 * مولّد مشتقّات WebP لأصول المكتبة المركزية (P9.2 — B.2a).
 *
 * المصدر (الأصل) يبقى نظيفاً ولا يُمَسّ أبداً. كل تعديل بصري = مشتقّ:
 *   thumb       → احتواء 400×400
 *   medium      → احتواء 1024×1024
 *   watermarked → الأصل + علامة مائية (اختياري — فقط عند تفعيلها في الإعدادات)
 *
 * يكتب المشتقّات بجانب الأصل ضمن نفس القرص، ويحدّث عمود conversions
 * بالمسارات والأبعاد. القرص قابل للتبديل (R2) عبر media-library.disk_name.
 */
final class MediaConversions
{
    /** @var array<string,array{w:int,h:int}> */
    private const SIZES = [
        'thumb' => ['w' => 400, 'h' => 400],
        'medium' => ['w' => 1024, 'h' => 1024],
    ];

    public static function generate(MediaAsset $asset): void
    {
        if (! $asset->isConvertibleImage()) {
            return;
        }

        $disk = Storage::disk($asset->disk);
        if (! $disk->exists($asset->path)) {
            return;
        }

        // نعمل على نسخة محلّية مؤقّتة من الأصل النظيف (يدعم الأقراص البعيدة مثل R2)
        $tmpSource = self::tempPath('mc_src_');
        file_put_contents($tmpSource, $disk->get($asset->path));

        // نسخة عمل محدودة الأبعاد لبناء كل المشتقّات منها: الأصل على القرص لا يُمَسّ
        // أبداً (نفس $asset->path كما هو) — فقط هذا الملف المؤقّت يُصغَّر عند الحاجة،
        // كي لا تُحمَّل صورة كاميرا/مسح متطرّفة الأبعاد كاملةً بالذاكرة الخام.
        $workingSource = self::normalize($tmpSource, $asset);

        $dir = trim(dirname($asset->path), '/.');
        $prefix = ($dir !== '' ? $dir.'/' : '').'conversions/';
        $base = pathinfo($asset->path, PATHINFO_FILENAME);
        $conversions = [];

        try {
            // ─── مشتقّات الحجم (thumb/medium) ───────────────────────────
            foreach (self::SIZES as $name => $size) {
                $tmpOut = self::tempPath('mc_out_', '.webp');
                try {
                    Image::load($workingSource)
                        ->fit(Fit::Contain, $size['w'], $size['h'])
                        ->format('webp')
                        ->save($tmpOut);

                    $relPath = $prefix.$base.'-'.$name.'.webp';
                    $disk->put($relPath, file_get_contents($tmpOut));

                    [$w, $h] = @getimagesize($tmpOut) ?: [null, null];
                    $conversions[$name] = ['path' => $relPath, 'width' => $w, 'height' => $h];
                } finally {
                    @unlink($tmpOut);
                }
            }

            // ─── مشتقّ العلامة المائية ──────────────────────────────────
            // العلامة مشتقّ من نسخة العمل (وليس الأصل الخام) — لا نموذج علامة خاص
            // بالمقال (B.2a). إلزاميّتها تحكمها WatermarkPolicy وليس فقط توفّر
            // الإعداد: محتوى عام (visibility=Public — كل شيء اليوم) يجب أن يحمل
            // علامة؛ فشل صامت هنا لأصل إلزامي = أصل "جاهز" بلا علامته المطلوبة.
            $watermarked = self::watermarkedDerivative($workingSource, $disk, $prefix, $base);
            $required = WatermarkPolicy::isRequired($asset);

            if ($watermarked !== null) {
                $conversions['watermarked'] = $watermarked;
            } elseif ($required && WatermarkSettings::current() !== null) {
                // الإعداد مفعّل والعلامة إلزامية، لكن التوليد فشل فعليًا (مثلاً تعذّر
                // فتح ملف الشعار) — فشل صريح بدل أصل "جاهز" بلا علامته الإلزامية.
                throw new RuntimeException(
                    "Watermark required for public asset {$asset->id} but generation failed."
                );
            } elseif ($required) {
                // إلزامية لكن لا إعداد فعّال إطلاقًا (watermark_enabled=false أو لا
                // صورة مضبوطة) — فجوة إعداد، وليست فشلاً مؤقتًا؛ تستحق تنبيهًا صريحًا
                // بدل تمرير مرور صامت (كان هذا سلوك اليوم قبل هذا الإصلاح).
                Log::warning(
                    "Watermark required for public media_asset {$asset->id} but watermark is not configured (watermark_enabled or watermark_image missing)."
                );
            }
        } finally {
            @unlink($tmpSource);
            if ($workingSource !== $tmpSource) {
                @unlink($workingSource);
            }
        }

        $asset->conversions = $conversions;
        $asset->save();
    }

    /**
     * نسخة عمل آمنة الحجم إن تجاوز المصدر سقف الأبعاد الآمن (performance.media.
     * working_max_dimension). الأصل على القرص لا يُمَسّ أبداً — فقط نسخة مؤقّتة.
     *
     * عبر Imagick (إن توفّر): Imagick::setSize() قبل readImage() يُفعّل shrink-on-load
     * حقيقيًا لصور JPEG (فكّ DCT مصغّر مباشرة من الملف) — الأبعاد الكاملة للمصدر لا
     * تُحمَّل بالذاكرة الخام إطلاقًا (على عكس GD الذي يفكّ الأصل كاملاً دومًا قبل أي
     * تصغير). بلا Imagick: لا حلّ حقيقي متاح على مستوى التطبيق، فنرفع سقف الذاكرة
     * لهذه العملية تحديدًا كإجراء احتياطي محدود (وليس بلا حدود) بدل سقوط الـ process.
     */
    private static function normalize(string $sourcePath, MediaAsset $asset): string
    {
        $maxDim = (int) config('performance.media.working_max_dimension', 8000);

        [$w, $h] = @getimagesize($sourcePath) ?: [null, null];
        if ($w === null || $h === null || max($w, $h) <= $maxDim) {
            return $sourcePath;
        }

        if (! class_exists(Imagick::class)) {
            $fallback = (string) config('performance.media.fallback_memory_limit', '1536M');
            @ini_set('memory_limit', $fallback);

            return $sourcePath;
        }

        $asset->forceFill(['processing_status' => 'normalizing'])->save();

        $scale = $maxDim / max($w, $h);
        $targetW = max(1, (int) round($w * $scale));
        $targetH = max(1, (int) round($h * $scale));

        $imagick = new Imagick;

        try {
            $imagick->setSize($targetW, $targetH);
            $imagick->readImage($sourcePath);
            $imagick->thumbnailImage($targetW, $targetH, true);
            $imagick->stripImage();

            $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION)) ?: 'jpg';
            $out = self::tempPath('mc_norm_', '.'.$ext);
            $imagick->writeImage($out);

            return $out;
        } finally {
            $imagick->clear();
            $imagick->destroy();
            $asset->forceFill(['processing_status' => 'processing'])->save();
        }
    }

    /**
     * يولّد مشتقّ علامة مائية من الأصل النظيف عند تفعيلها في الإعدادات.
     *
     * @return array{path:string,width:?int,height:?int}|null
     */
    private static function watermarkedDerivative(
        string $tmpSource,
        Filesystem $disk,
        string $prefix,
        string $base,
    ): ?array {
        $cfg = WatermarkSettings::current();
        if ($cfg === null) {
            return null; // العلامة معطّلة — لا مشتقّ
        }

        $watermark = WatermarkSettings::resolveLogoPath();
        if ($watermark === null) {
            return null; // مسار العلامة غير محلول — تخطٍّ آمن
        }

        $tmpOut = self::tempPath('mc_wm_', '.webp');
        try {
            (new WatermarkProcessor)->apply(
                $tmpSource,
                $watermark,
                $tmpOut,
                $cfg['opacity'],
                $cfg['width'],
                $cfg['margin'],
                $cfg['position'],
            );

            $relPath = $prefix.$base.'-watermarked.webp';
            $disk->put($relPath, file_get_contents($tmpOut));

            [$w, $h] = @getimagesize($tmpOut) ?: [null, null];

            return ['path' => $relPath, 'width' => $w, 'height' => $h];
        } finally {
            @unlink($tmpOut);
        }
    }

    /**
     * مسار ملفّ مؤقّت محلّيّ داخل storage/app/tmp (مملوك للتطبيق، موجود وقابل للكتابة).
     * لا نستعمل tempnam(): على Windows/PHP 8.4 يفشل (يُعيد false) ويُطلق E_NOTICE حين تحتوي
     * البادئة على «_» (يحوّله معالج الأخطاء إلى ErrorException)، وكان يخلّف ملفّاً يتيماً لأنّ
     * اللاحقة تُضاف لمسار مختلف عمّا أنشأه. اسم فريد عبر random_bytes (آمن من التصادم)، عبر-منصّات.
     */
    private static function tempPath(string $prefix, string $ext = ''): string
    {
        $dir = storage_path('app/tmp');
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir.DIRECTORY_SEPARATOR.$prefix.bin2hex(random_bytes(8)).$ext;
    }
}
