<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Models\Epaper;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * حذف نهائيّ لعدد — تتسلسل النسخ وتاريخ المسارات (FK cascade). الوسائط لا تُحذف
 * (مشتركة/مُزالة التكرار؛ تنظيف اليتيم عبر مهمة الوسائط الدورية).
 */
class ForceDeleteEpaperAction
{
    public function handle(Epaper $epaper): JsonResponse
    {
        $tags = FrontendCacheTags::epaper($epaper); // يُلتقَط قبل الحذف — نفس نمط ForceDeleteArticleAction
        $epaper->forceDelete();

        FrontendRevalidate::tags($tags);

        return ApiResponse::success(__('epaper.force_deleted'));
    }
}
