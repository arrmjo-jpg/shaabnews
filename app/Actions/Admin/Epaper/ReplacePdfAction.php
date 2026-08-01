<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Actions\Admin\Media\StoreMediaAssetAction;
use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Jobs\GenerateEpaperCoverJob;
use App\Models\Epaper;
use App\Models\EpaperVersion;
use App\Models\User;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * استبدال ملف الـ PDF: يخزّن الملف الجديد، يرفع رقم النسخة، ويُنشئ صفّ نسخة جديد
 * (versioning — النسخ السابقة محفوظة). يُصفِّر ميتاداتا الوثيقة (تُعاد الكشف/الـ OCR
 * في المرحلة 4). **لا يُسجَّل تحويل** — الرابط العام (slug) لم يتغيّر (قرار #2).
 */
class ReplacePdfAction
{
    public function handle(Epaper $epaper, UploadedFile $file, ?string $note, User $actor): JsonResponse
    {
        DB::transaction(function () use ($epaper, $file, $note, $actor): void {
            $asset = (new StoreMediaAssetAction)->handle($file, $actor);

            $epaper->forceFill([
                'media_asset_id' => $asset->id,
                'current_version' => $epaper->current_version + 1,
            ])->save();

            EpaperVersion::create([
                'epaper_id' => $epaper->id,
                'version' => $epaper->current_version,
                'media_asset_id' => $asset->id,
                'note' => $note,
                'created_by' => $actor->id,
            ]);
        });

        // OCR مُعطَّل عمداً بقرار منتج — لا إعادة جدولة استخراج نصّ عند استبدال الملفّ.
        // الصفحة الأولى تغيّرت ⇒ أعِد توليد الغلاف.
        GenerateEpaperCoverJob::enqueue($epaper);

        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper));

        return ApiResponse::success(
            __('epaper.pdf_replaced'),
            new EpaperResource($epaper->fresh()->load(['mediaAsset', 'author'])),
        );
    }
}
