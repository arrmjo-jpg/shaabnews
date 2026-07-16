<?php

declare(strict_types=1);

namespace App\Actions\Admin\Settings;

use App\Http\Resources\Admin\Settings\GeneralSettingsResource;
use App\Settings\GeneralSettings;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;

class UploadBrandingAction
{
    private const FIELDS = ['logo_light', 'logo_dark', 'logo_light_en', 'logo_dark_en', 'favicon', 'watermark_image'];

    /**
     * @param  array<string, UploadedFile>  $files
     */
    public function handle(array $files): JsonResponse
    {
        $settings = app(GeneralSettings::class);

        foreach (self::FIELDS as $field) {
            if (! isset($files[$field])) {
                continue;
            }

            $path = $files[$field]->store('branding', 'public');
            $settings->{$field} = $path;
        }

        $settings->save();

        Cache::tags(['settings'])->flush();

        return ApiResponse::success(
            __('setting.branding_uploaded'),
            new GeneralSettingsResource($settings)
        );
    }
}
