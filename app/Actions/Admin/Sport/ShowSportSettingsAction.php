<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Settings\SportSettings;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class ShowSportSettingsAction
{
    public function handle(SportSettings $settings): JsonResponse
    {
        return ApiResponse::success(data: [
            'sport_primary_color' => $settings->sport_primary_color,
            'sport_secondary_color' => $settings->sport_secondary_color,
            'sport_default_theme' => $settings->sport_default_theme,
            'sport_allow_theme_switch' => $settings->sport_allow_theme_switch,
            'sport_theme_cookie' => $settings->sport_theme_cookie,
            'sport_default_sport' => $settings->sport_default_sport,
            'sport_default_country' => $settings->sport_default_country,
            'sport_default_competition' => $settings->sport_default_competition,
            'sport_prediction_enabled' => $settings->sport_prediction_enabled,
            'sport_search_enabled' => $settings->sport_search_enabled,
            'sport_live_scores_enabled' => $settings->sport_live_scores_enabled,
        ]);
    }
}
