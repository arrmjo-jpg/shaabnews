<?php

declare(strict_types=1);

namespace App\Actions\Admin\Settings;

use App\Http\Resources\Admin\Settings\GeneralSettingsResource;
use App\Settings\GeneralSettings;
use App\Support\Audit\SettingsAudit;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class UpdateGeneralSettingsAction
{
    public function handle(array $validated): JsonResponse
    {
        $settings = app(GeneralSettings::class);
        $secrets = GeneralSettings::encrypted();

        foreach ($validated as $key => $value) {
            // لا تستبدل سرّاً موجوداً بقيمة فارغة أو القناع
            if (in_array($key, $secrets, true)
                && ($value === null || $value === '' || $value === '********')) {
                continue;
            }

            $settings->{$key} = $value ?? '';
        }

        if (array_key_exists('site_name_ar', $validated)) {
            $settings->site_name = $validated['site_name_ar'] ?? '';
        }
        if (array_key_exists('site_description_ar', $validated)) {
            $settings->site_description = $validated['site_description_ar'] ?? '';
        }
        if (array_key_exists('copyright_text_ar', $validated)) {
            $settings->copyright_text = $validated['copyright_text_ar'] ?? '';
        }
        if (array_key_exists('cookie_policy_text_ar', $validated)) {
            $settings->cookie_policy_text = $validated['cookie_policy_text_ar'] ?? '';
        }
        // جهات الاتصال: نظّف كلّ عنصر {name,title,phone}، أسقِط ما بلا رقم، وزامن الأوّل مع site_phone.
        if (array_key_exists('site_phones', $validated)) {
            $contacts = array_values(array_filter(array_map(static function ($c): array {
                $c = is_array($c) ? $c : ['phone' => $c];

                return [
                    'name' => trim((string) ($c['name'] ?? '')),
                    'title' => trim((string) ($c['title'] ?? '')),
                    'phone' => trim((string) ($c['phone'] ?? '')),
                ];
            }, $validated['site_phones'] ?? []), static fn (array $c): bool => $c['phone'] !== ''));

            $settings->site_phones = $contacts;
            $settings->site_phone = $contacts[0]['phone'] ?? '';
        }

        $settings->save(); // spatie يشفّر حقول encrypted() تلقائياً
        SettingsAudit::log('general', array_keys($validated), $secrets);

        Cache::tags(['settings'])->flush();
        // إبطال واجهة Next: /site (هيدر/فوتر/SEO/شعارات) يتغذّى من هذه الإعدادات.
        FrontendRevalidate::tags(['site-settings']);

        return ApiResponse::success(
            __('setting.updated'),
            new GeneralSettingsResource($settings)
        );
    }
}
