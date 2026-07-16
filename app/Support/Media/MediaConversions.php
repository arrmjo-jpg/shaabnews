<?php

declare(strict_types=1);

namespace App\Support\Media;

use App\Models\MediaAsset;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
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

        $dir = trim(dirname($asset->path), '/.');
        $prefix = ($dir !== '' ? $dir.'/' : '').'conversions/';
        $base = pathinfo($asset->path, PATHINFO_FILENAME);
        $conversions = [];

        // ─── مشتقّات الحجم (thumb/medium) ───────────────────────────────
        foreach (self::SIZES as $name => $size) {
            $tmpOut = self::tempPath('mc_out_', '.webp');
            try {
                Image::load($tmpSource)
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

        // ─── مشتقّ العلامة المائية (اختياري) ────────────────────────────
        // العلامة مشتقّ من الأصل النظيف؛ لا نموذج علامة خاص بالمقال (B.2a).
        $watermarked = self::watermarkedDerivative($tmpSource, $disk, $prefix, $base);
        if ($watermarked !== null) {
            $conversions['watermarked'] = $watermarked;
        }

        @unlink($tmpSource);

        $asset->conversions = $conversions;
        $asset->save();
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

        $watermark = self::resolveWatermarkPath($cfg['path']);
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

    private static function resolveWatermarkPath(string $path): ?string
    {
        foreach ([public_path($path), storage_path('app/public/'.$path), $path] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
