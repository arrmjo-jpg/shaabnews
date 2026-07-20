<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class UpdateSportSettingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (settings.edit)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'sport_primary_color' => ['sometimes', 'nullable', 'string', 'max:20'],
            'sport_secondary_color' => ['sometimes', 'nullable', 'string', 'max:20'],
            'sport_default_theme' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'sport_allow_theme_switch' => ['sometimes', 'boolean'],
            'sport_theme_cookie' => ['sometimes', 'string', 'max:100'],
            'sport_default_sport' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sport_default_country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sport_default_competition' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sport_prediction_enabled' => ['sometimes', 'boolean'],
            'sport_search_enabled' => ['sometimes', 'boolean'],
            'sport_live_scores_enabled' => ['sometimes', 'boolean'],
        ];
    }
}
