<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Models\Epaper;
use App\Models\EpaperUrlHistory;
use App\Support\Epaper\EpaperSearchIndexer;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * تعديل ميتاداتا العدد. يُسجَّل تحويل (url_history) فقط إذا تغيّر الـ slug فعلاً —
 * أي تغيّر الرابط العام (قرار #2). تغيير عنوان دون slug لا يولّد slug جديداً
 * (Sluggable لا يُحدِّث فوق slug غير فارغ) فلا تحويل.
 */
class UpdateEpaperAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(Epaper $epaper, array $data): JsonResponse
    {
        $oldPath = $epaper->canonicalPath();
        $oldLocale = $epaper->locale;

        $epaper->fill($data); // fillable يرشّح المفاتيح؛ slug صريح يُضبَط كما هو
        $epaper->save();

        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper, oldLocale: $oldLocale));

        // تحويل فقط عند تغيّر الرابط العام (الـ slug) — لا تكرار (firstOrCreate).
        if ($epaper->wasChanged('slug')) {
            EpaperUrlHistory::firstOrCreate(
                ['locale' => $epaper->locale, 'old_path' => $oldPath],
                ['epaper_id' => $epaper->id, 'reason' => 'slug_change'],
            );
        }

        // الميتاداتا (العنوان/الوصول/اللغة/التاريخ/الرقم) مُغناة في وثائق الصفحات — أعِد
        // الفهرسة كي تبقى الحقول المنسوخة (وفرض الوصول داخل المحرّك) متّسقةً مع المصدر.
        if ($epaper->wasChanged(['title', 'subtitle', 'slug', 'access_level', 'locale', 'publication_date', 'issue_number'])) {
            EpaperSearchIndexer::queueSync($epaper->id);
        }

        return ApiResponse::success(
            __('epaper.updated'),
            new EpaperResource($epaper->fresh()->load(['mediaAsset', 'author'])),
        );
    }
}
