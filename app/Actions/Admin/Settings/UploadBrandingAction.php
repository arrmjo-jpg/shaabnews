<?php

declare(strict_types=1);

namespace App\Actions\Admin\Settings;

use App\Http\Resources\Admin\Settings\GeneralSettingsResource;
use App\Settings\GeneralSettings;
use App\Support\Frontend\FrontendRevalidate;
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

        // إبطال كاش الواجهة أيضاً — لا الباك إند وحده. الشعار/الفافيكون/العلامة المائية
        // تُقرأ من GET /api/v1/site الموسوم site-settings في Next؛ بلا هذا السطر كان
        // تفريغ كاش الباك إند يجعل الـAPI صحيحاً فوراً بينما تبقى الصفحات المُولَّدة على
        // الشعار القديم حتى انقضاء سقف الـISR (300 ثانية) — أي أن المحرّر يحفظ ولا يرى
        // أثراً. نفس السطر الموجود في UpdateGeneralSettingsAction لنفس الوسم بالضبط.
        FrontendRevalidate::tags(['site-settings']);

        return ApiResponse::success(
            __('setting.branding_uploaded'),
            new GeneralSettingsResource($settings)
        );
    }
}
