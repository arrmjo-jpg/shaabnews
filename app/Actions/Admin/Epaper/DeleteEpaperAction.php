<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Models\Epaper;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/** حذف ناعم لعدد (قابل للاسترجاع) — الوسائط لا تُلمَس (مشتركة/مُزالة التكرار). */
class DeleteEpaperAction
{
    public function handle(Epaper $epaper): JsonResponse
    {
        $epaper->delete();

        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper));

        return ApiResponse::success(__('epaper.deleted'));
    }
}
