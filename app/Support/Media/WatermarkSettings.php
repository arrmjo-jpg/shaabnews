<?php

declare(strict_types=1);

namespace App\Support\Media;

use App\Settings\GeneralSettings;
use Throwable;

/**
 * إعداد العلامة المائية مشتقّ من لوحة الإعدادات (spatie/laravel-settings).
 * يُرجع config أو null عند التعطيل/غياب صورة العلامة.
 */
final class WatermarkSettings
{
    /** @return array{path:string,position:string,opacity:int,width:int,margin:int}|null */
    public static function current(): ?array
    {
        try {
            $s = app(GeneralSettings::class);
        } catch (Throwable) {
            return null;
        }

        if (! $s->watermark_enabled || empty($s->watermark_image)) {
            return null;
        }

        return [
            'path' => (string) $s->watermark_image,
            'position' => (string) $s->watermark_position,
            'opacity' => (int) $s->watermark_opacity,
            'width' => (int) $s->watermark_width,
            'margin' => (int) $s->watermark_margin,
        ];
    }

    /**
     * يحلّ مسار ملفّ شعار العلامة الفعلي على القرص، أو null إن كانت معطّلة أو
     * الملف غير موجود في أيّ من المرشّحات. مشتركة بين MediaConversions (توليد
     * المشتقّ) وMediaProcessingHealthCheck (كشف "مفعّلة لكن الملف مفقود" بدل
     * فشل صامت لا أثر له في أي سجلّ).
     */
    public static function resolveLogoPath(): ?string
    {
        $cfg = self::current();
        if ($cfg === null) {
            return null;
        }

        foreach ([public_path($cfg['path']), storage_path('app/public/'.$cfg['path']), $cfg['path']] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
