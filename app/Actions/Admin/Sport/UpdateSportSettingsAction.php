<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Settings\SportSettings;
use App\Support\Audit\SettingsAudit;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class UpdateSportSettingsAction
{
    public function handle(SportSettings $settings, array $validated): JsonResponse
    {
        $changed = [];

        foreach ($validated as $field => $value) {
            if ($settings->{$field} !== $value) {
                $settings->{$field} = $value;
                $changed[] = $field;
            }
        }

        if ($changed !== []) {
            $settings->save();
            SettingsAudit::log('sport_settings', $changed);
            FrontendRevalidate::tags(['sport-settings']);
        }

        return (new ShowSportSettingsAction)->handle($settings);
    }
}
