<?php

declare(strict_types=1);

namespace App\Actions\Admin\Media;

use App\Jobs\GenerateMediaAssetConversionsJob;
use App\Models\MediaAsset;
use App\Support\Media\WatermarkPolicy;
use App\Support\Media\WatermarkSettings;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * استرداد المشتقّات المفقودة فقط — لا إعادة توليد شاملة.
 *
 * الفرق عن RegenerateMediaDerivativesAction: تلك تُجدوِل **كل** أصل صورة (تُستخدَم بعد تغيير
 * إعدادات العلامة المائية، حيث المطلوب فعلاً إعادة كتابة الجميع). هذه تفحص القرص أوّلاً
 * وتتخطّى كل أصل مشتقّاته مكتملة، فلا تُعاد كتابة ملف سليم بلا داعٍ.
 *
 * لماذا الفحص على القرص لا على عمود conversions: العمود قد يسجّل مسارات لملفات غير موجودة
 * (نسخة قاعدة بيانات من بيئة أخرى لم تُنقَل معها المشتقّات) — وهذه بالضبط الحالة التي يعالجها
 * هذا الإجراء. المصدر الوحيد للحقيقة هنا هو نظام الملفات.
 *
 * idempotent: تشغيلها مجدّداً بعد نجاحها لا يُجدوِل شيئاً (صارت كل المشتقّات موجودة).
 *
 * ملاحظة: MediaConversions::generate() تُنتج المشتقّات الثلاثة معاً — لا توليد جزئيّ. فأصل
 * ينقصه مشتقّ واحد تُعاد كتابة مشتقّاته كلها. الأصل نفسه لا يُمَسّ أبداً.
 */
class RepairMissingMediaDerivativesAction
{
    /**
     * @return array{scanned:int,skipped:int,repaired:int,failed:int,unrepairable:int,elapsed:float}
     */
    public function handle(bool $sync = false, bool $dryRun = false, ?int $limit = null, int $chunk = 200): array
    {
        $start = microtime(true);
        $scanned = 0;
        $skipped = 0;
        $repaired = 0;
        $failed = 0;
        $unrepairable = 0;

        // العلامة المائية متوقَّعة فقط حين تكون مضبوطة فعلاً؛ وإلّا لا نعتبر غيابها نقصاً
        // (وإلّا لظلّ كل أصل عامّ "ناقصاً" إلى الأبد ولأُعيد توليده في كل تشغيل).
        $watermarkConfigured = WatermarkSettings::current() !== null;

        MediaAsset::query()
            ->library()
            ->whereIn('mime_type', ['image/jpeg', 'image/png', 'image/webp'])
            ->orderBy('id')
            ->chunkById($chunk, function ($assets) use (
                &$scanned, &$skipped, &$repaired, &$failed, &$unrepairable,
                $sync, $dryRun, $limit, $watermarkConfigured
            ): bool {
                foreach ($assets as $asset) {
                    if ($limit !== null && ($repaired + $failed) >= $limit) {
                        return false; // أوقف الترقيم بالكامل
                    }

                    $scanned++;
                    $disk = Storage::disk($asset->disk);

                    // بلا أصل سليم لا يمكن اشتقاق أي شيء — لا تُجدوِل عملاً محكوماً بالفشل.
                    if ($asset->path === null || $asset->path === '' || ! $disk->exists($asset->path)) {
                        $unrepairable++;

                        continue;
                    }

                    if (! $this->hasMissingDerivative($asset, $disk, $watermarkConfigured)) {
                        $skipped++;

                        continue;
                    }

                    if ($dryRun) {
                        $repaired++; // «سيُجدوَل» في وضع العرض فقط

                        continue;
                    }

                    try {
                        if ($sync) {
                            GenerateMediaAssetConversionsJob::dispatchSync($asset->id);

                            // لا نثق بحالة الوظيفة: MediaConversions تسجّل المشتقّ في قاعدة
                            // البيانات دون فحص نتيجة الكتابة (تقرأ الأبعاد من الملف المؤقّت لا
                            // من الوجهة)، فكتابة فاشلة تُنتج سجلاً «ناجحاً» بلا ملف — وهي نفس
                            // حالة الانحراف التي نستردّ منها. الحقيقة = القرص بعد التوليد.
                            clearstatcache();
                            if ($this->hasMissingDerivative($asset->fresh(), $disk, $watermarkConfigured)) {
                                $failed++;

                                continue;
                            }
                        } else {
                            $asset->forceFill(['processing_status' => 'queued'])->save();
                            GenerateMediaAssetConversionsJob::dispatch($asset->id);
                        }
                        $repaired++;
                    } catch (Throwable) {
                        // الوظيفة نفسها تضع processing_status=failed؛ هنا نُحصي فقط كي لا
                        // يتوقّف الاسترداد كلّه بسبب أصل واحد.
                        $failed++;
                    }
                }

                return true;
            });

        return [
            'scanned' => $scanned,
            'skipped' => $skipped,
            'repaired' => $repaired,
            'failed' => $failed,
            'unrepairable' => $unrepairable,
            'elapsed' => microtime(true) - $start,
        ];
    }

    /** أوّل مشتقّ مفقود يكفي لإدراج الأصل — لا داعي لإكمال بقيّة الفحوص. */
    private function hasMissingDerivative(MediaAsset $asset, $disk, bool $watermarkConfigured): bool
    {
        foreach ($this->expectedDerivativePaths($asset, $watermarkConfigured) as $path) {
            if (! $disk->exists($path)) {
                return true;
            }
        }

        return false;
    }

    /**
     * المسارات المتوقَّعة — تطابق ما تكتبه MediaConversions حرفياً:
     * {dir}/conversions/{base}-{thumb|medium|watermarked}.webp
     *
     * @return list<string>
     */
    private function expectedDerivativePaths(MediaAsset $asset, bool $watermarkConfigured): array
    {
        $dir = trim(dirname($asset->path), '/.');
        $prefix = ($dir !== '' ? $dir.'/' : '').'conversions/';
        $base = pathinfo($asset->path, PATHINFO_FILENAME);

        $paths = [
            $prefix.$base.'-thumb.webp',
            $prefix.$base.'-medium.webp',
        ];

        if ($watermarkConfigured && WatermarkPolicy::isRequired($asset)) {
            $paths[] = $prefix.$base.'-watermarked.webp';
        }

        return $paths;
    }
}
