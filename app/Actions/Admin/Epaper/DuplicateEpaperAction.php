<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Enums\EpaperStatus;
use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Models\Epaper;
use App\Models\EpaperVersion;
use App\Models\User;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * تكرار عدد كمسودّة جديدة للتحرير: ينسخ الميتاداتا ويعيد استخدام مرجع الـ PDF نفسه
 * (لا رفع جديد). رقم العدد = التالي المتاح للّغة؛ slug يُعاد توليده فريداً؛ الحالة
 * مسودّة؛ النسخة 1. لا تحويل (عدد جديد بمساره الخاصّ).
 */
class DuplicateEpaperAction
{
    public function handle(Epaper $epaper, User $actor): JsonResponse
    {
        $copy = DB::transaction(function () use ($epaper, $actor): Epaper {
            $nextNumber = (int) (Epaper::withTrashed()
                ->where('locale', $epaper->locale)
                ->max('issue_number')) + 1;

            $copy = new Epaper;
            $copy->fill([
                'locale' => $epaper->locale,
                'issue_number' => $nextNumber,
                'title' => $epaper->title.' (نسخة)',
                'subtitle' => $epaper->subtitle,
                'summary' => $epaper->summary,
                'publication_date' => $epaper->publication_date,
                'media_asset_id' => $epaper->media_asset_id, // إعادة استخدام نفس الـ PDF (ديدوب)
                'author_id' => $actor->id,
                'status' => EpaperStatus::Draft->value,
                'current_version' => 1,
            ]);
            $copy->save(); // slug يُولَّد تلقائياً فريداً من العنوان الجديد

            if ($copy->media_asset_id !== null) {
                EpaperVersion::create([
                    'epaper_id' => $copy->id,
                    'version' => 1,
                    'media_asset_id' => $copy->media_asset_id,
                    'note' => 'نسخة من العدد #'.$epaper->issue_number,
                    'created_by' => $actor->id,
                ]);
            }

            return $copy;
        });

        FrontendRevalidate::tags(FrontendCacheTags::epaper($copy));

        return ApiResponse::success(
            __('epaper.duplicated'),
            new EpaperResource($copy->fresh()->load(['mediaAsset', 'author'])),
            201,
        );
    }
}
