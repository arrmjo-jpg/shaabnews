<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Sport;

use App\Actions\Admin\Sport\ShowCompetitionBarSettingsAction;
use App\Actions\Admin\Sport\UpdateCompetitionBarSettingsAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Sport\UpdateBarSettingsRequest;
use App\Settings\SportsHomeBarSettings;
use Illuminate\Http\JsonResponse;

class SportsHomeBarSettingsController extends Controller
{
    public function show(ShowCompetitionBarSettingsAction $action): JsonResponse
    {
        return $action->handle(app(SportsHomeBarSettings::class)->enabled, 'show_in_sports_home_bar');
    }

    public function update(UpdateBarSettingsRequest $request, UpdateCompetitionBarSettingsAction $action): JsonResponse
    {
        return $action->handle(
            settings: app(SportsHomeBarSettings::class),
            enabled: (bool) $request->validated()['enabled'],
            auditGroup: 'sports_home_bar',
            cacheTag: 'sports-home-bar',
        );
    }
}
