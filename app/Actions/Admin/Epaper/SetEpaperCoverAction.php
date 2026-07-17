<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Models\Epaper;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * تعيين غلاف العدد يدوياً — يخزّن الصورة المرفوعة على قرص أصل الـ PDF ويكتب مسارها في
 * conversions['cover'] (نفس فتحة المُولَّد تلقائياً عبر pdftoppm). يعمل على أي بيئة بلا
 * اعتماد على poppler. لا أصل ⇒ خطأ صريح (لا تلفيق).
 */
class SetEpaperCoverAction
{
    public function handle(Epaper $epaper, UploadedFile $image): JsonResponse
    {
        $asset = $epaper->mediaAsset;
        if ($asset === null) {
            return ApiResponse::error(__('epaper.no_document'), [], 422);
        }

        $disk = Storage::disk($asset->disk);
        $dir = trim(str_replace('\\', '/', dirname($asset->path)), '.');
        $ext = strtolower($image->getClientOriginalExtension() ?: 'jpg');
        $coverPath = ($dir !== '' && $dir !== '/' ? rtrim($dir, '/').'/' : '').'cover.'.$ext;

        $disk->put($coverPath, (string) file_get_contents($image->getRealPath()));

        $conversions = $asset->conversions ?? [];
        $conversions['cover'] = ['path' => $coverPath, 'mime' => (string) $image->getMimeType()];
        $asset->forceFill(['conversions' => $conversions])->save();

        FrontendRevalidate::tags(FrontendCacheTags::epaper($epaper));

        return ApiResponse::success(
            __('epaper.cover_set'),
            new EpaperResource($epaper->fresh()->load(['mediaAsset', 'author'])),
        );
    }
}
