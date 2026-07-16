<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Settings;

use App\Actions\Admin\Settings\Media\DeleteMediaAssetAction;
use App\Actions\Admin\Settings\Media\UploadBrandingMediaAction;
use App\Actions\Admin\Settings\Media\UploadFirebaseMediaAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Settings\Media\UploadBrandingMediaRequest;
use App\Http\Requests\Admin\Settings\Media\UploadFirebaseMediaRequest;
use App\Models\MediaAsset;
use Illuminate\Http\JsonResponse;

class MediaController extends Controller
{
    public function uploadBranding(UploadBrandingMediaRequest $request): JsonResponse
    {
        $files = [];
        foreach (['logo_light', 'logo_dark', 'logo_light_en', 'logo_dark_en', 'favicon', 'watermark_image'] as $field) {
            if ($request->hasFile($field)) {
                $files[$field] = $request->file($field);
            }
        }

        return (new UploadBrandingMediaAction)->handle($files, $request->user());
    }

    public function uploadFirebase(UploadFirebaseMediaRequest $request): JsonResponse
    {
        return (new UploadFirebaseMediaAction)->handle(
            $request->file('service_account'),
            $request->user()
        );
    }

    public function destroy(MediaAsset $mediaAsset): JsonResponse
    {
        return (new DeleteMediaAssetAction)->handle($mediaAsset);
    }
}
