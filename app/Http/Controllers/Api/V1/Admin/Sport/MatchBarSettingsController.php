<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Sport;

use App\Actions\Admin\Sport\ShowMatchBarSettingsAction;
use App\Actions\Admin\Sport\UpdateMatchBarSettingsAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Sport\UpdateMatchBarSettingsRequest;
use Illuminate\Http\JsonResponse;

class MatchBarSettingsController extends Controller
{
    public function show(ShowMatchBarSettingsAction $action): JsonResponse
    {
        return $action->handle();
    }

    public function update(UpdateMatchBarSettingsRequest $request, UpdateMatchBarSettingsAction $action): JsonResponse
    {
        return $action->handle($request->validated());
    }
}
