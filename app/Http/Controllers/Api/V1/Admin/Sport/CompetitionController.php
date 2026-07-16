<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Sport;

use App\Actions\Admin\Sport\CreateCompetitionAction;
use App\Actions\Admin\Sport\DeleteCompetitionAction;
use App\Actions\Admin\Sport\ListCompetitionsAction;
use App\Actions\Admin\Sport\UpdateCompetitionAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Sport\StoreCompetitionRequest;
use App\Http\Requests\Admin\Sport\UpdateCompetitionRequest;
use App\Models\Competition;
use Illuminate\Http\JsonResponse;

class CompetitionController extends Controller
{
    public function index(ListCompetitionsAction $action): JsonResponse
    {
        return $action->handle();
    }

    public function store(StoreCompetitionRequest $request, CreateCompetitionAction $action): JsonResponse
    {
        return $action->handle($request->validated());
    }

    public function update(UpdateCompetitionRequest $request, Competition $competition, UpdateCompetitionAction $action): JsonResponse
    {
        return $action->handle($competition, $request->validated());
    }

    public function destroy(Competition $competition, DeleteCompetitionAction $action): JsonResponse
    {
        return $action->handle($competition);
    }
}
