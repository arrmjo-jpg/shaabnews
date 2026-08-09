<?php

declare(strict_types=1);

namespace App\Support\Epaper;

use App\Models\Epaper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * توليد غلاف العدد من الصفحة الأولى — يعيد استخدام نظام مشتقّات الوسائط القائم
 * (MediaAsset.conversions['cover'])؛ لا نظام Media جديد. يُصيّر الصفحة 1 عبر poppler
 * pdftoppm ويخزّن الصورة على قرص الأصل نفسه، ثمّ يكتب مسارها في conversions['cover']
 * (يقرأها MediaAsset::conversionUrl('cover')).
 *
 * لا يكسر الأعداد القديمة: لا غلاف ⇒ conversions['cover'] غائب ⇒ المورد يُرجع null.
 */
final class EpaperCoverGenerator
{
    public function generate(Epaper $epaper): bool
    {
        $asset = $epaper->mediaAsset;
        if ($asset === null || $asset->path === '') {
            return false;
        }

        $disk = Storage::disk($asset->disk);
        if (! $disk->exists($asset->path)) {
            return false;
        }

        $tmpPdf = tempnam(sys_get_temp_dir(), 'epcov_');
        if ($tmpPdf === false) {
            return false;
        }

        $outPrefix = $tmpPdf.'_p1';
        $outImage = $outPrefix.'.jpg';

        try {
            file_put_contents($tmpPdf, $disk->get($asset->path));

            // صفحة واحدة فقط (1) إلى JPEG؛ -singlefile ⇒ المخرج <prefix>.jpg بلا لاحقة رقم.
            $binary = (string) config('epaper.cover.pdftoppm', 'pdftoppm');
            $dpi = (string) (int) config('epaper.cover.dpi', 150);
            $process = new Process([$binary, '-jpeg', '-singlefile', '-f', '1', '-l', '1', '-r', $dpi, $tmpPdf, $outPrefix]);
            $process->setTimeout((int) config('epaper.cover.timeout', 120));
            $process->run();

            if (! $process->isSuccessful() || ! is_file($outImage)) {
                Log::info('epaper.cover.unprocessed', ['epaper_id' => $epaper->id, 'reason' => 'render_failed']);

                return false;
            }

            // تخزين الغلاف على قرص الأصل بجوار الـ PDF (نفس مجلّد الأصل).
            $dir = trim(str_replace('\\', '/', dirname($asset->path)), '.');
            $coverPath = ($dir !== '' && $dir !== '/' ? rtrim($dir, '/').'/' : '').'cover.jpg';
            $disk->put($coverPath, (string) file_get_contents($outImage));

            // كتابة المشتقّ في conversions (دمج مع الموجود؛ forceFill يطلق أحداث التدقيق).
            $conversions = $asset->conversions ?? [];
            $conversions['cover'] = ['path' => $coverPath, 'mime' => 'image/jpeg'];
            $asset->forceFill(['conversions' => $conversions])->save();

            return true;
        } catch (Throwable $e) {
            Log::warning('epaper.cover.failed', ['epaper_id' => $epaper->id, 'error' => $e->getMessage()]);

            return false;
        } finally {
            if (is_file($tmpPdf)) {
                @unlink($tmpPdf);
            }
            if (is_file($outImage)) {
                @unlink($outImage);
            }
        }
    }
}
