<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Actions\Admin\Media\StoreMediaAssetAction;
use App\Enums\EpaperAccessLevel;
use App\Enums\EpaperStatus;
use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Jobs\ExtractEpaperTextJob;
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
 * إنشاء عدد رقميّ (مسودّة) من PDF مرفوع: يخزّن الملف عبر مكتبة الوسائط (خام، بلا
 * تحويل) ثمّ يُنشئ العدد + نسخته الأولى (versioning). حدود معاملة لكل عدد.
 */
class CreateEpaperAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(array $data, UploadedFile $file, User $actor): JsonResponse
    {
        $epaper = DB::transaction(function () use ($data, $file, $actor): Epaper {
            $asset = (new StoreMediaAssetAction)->handle($file, $actor);

            $epaper = new Epaper;
            $epaper->fill([
                'locale' => $data['locale'] ?? 'ar',
                'issue_number' => (int) $data['issue_number'],
                'title' => $data['title'],
                'subtitle' => $data['subtitle'] ?? null,
                'summary' => $data['summary'] ?? null,
                'brief_points' => $data['brief_points'] ?? null,
                'highlights' => $data['highlights'] ?? null,
                'inside_this_issue' => $data['inside_this_issue'] ?? null,
                'publication_date' => $data['publication_date'],
                'access_level' => $data['access_level'] ?? EpaperAccessLevel::Public->value,
                'media_asset_id' => $asset->id,
                'author_id' => $actor->id,
                'status' => EpaperStatus::Draft->value,
                'current_version' => 1,
            ]);
            if (! empty($data['slug'])) {
                $epaper->slug = $data['slug']; // صريح — Sluggable لا يولّد فوق slug غير فارغ
            }
            $epaper->save();

            EpaperVersion::create([
                'epaper_id' => $epaper->id,
                'version' => 1,
                'media_asset_id' => $asset->id,
                'note' => $data['note'] ?? null,
                'created_by' => $actor->id,
            ]);

            return $epaper;
        });

        // استخراج نصّ العدد (OCR) خارج دورة الطلب — Phase 4a (يضبط pending ويُجدوِل).
        ExtractEpaperTextJob::enqueue($epaper);

        // توليد غلاف العدد من الصفحة الأولى (مشتقّ conversions['cover']) — خارج دورة الطلب.
        GenerateEpaperCoverJob::enqueue($epaper);

        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper));

        return ApiResponse::success(
            __('epaper.created'),
            new EpaperResource($epaper->fresh()->load(['mediaAsset', 'author'])),
            201,
        );
    }
}
