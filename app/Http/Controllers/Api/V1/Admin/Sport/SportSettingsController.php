<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Sport;

use App\Actions\Admin\Sport\ShowSportSettingsAction;
use App\Actions\Admin\Sport\UpdateSportSettingsAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Sport\UpdateSportSettingsRequest;
use App\Settings\SportSettings;
use Illuminate\Http\JsonResponse;

class SportSettingsController extends Controller
{
    public function show(ShowSportSettingsAction $action): JsonResponse
    {
        return $action->handle(app(SportSettings::class));
    }

    public function update(UpdateSportSettingsRequest $request, UpdateSportSettingsAction $action): JsonResponse
    {
        return $action->handle(app(SportSettings::class), $request->validated());
    }
}
