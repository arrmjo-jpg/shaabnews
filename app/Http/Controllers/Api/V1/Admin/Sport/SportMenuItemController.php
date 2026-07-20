<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Sport;

use App\Actions\Admin\Sport\CreateSportMenuItemAction;
use App\Actions\Admin\Sport\DeleteSportMenuItemAction;
use App\Actions\Admin\Sport\ListSportMenuItemsAction;
use App\Actions\Admin\Sport\ReorderSportMenuItemsAction;
use App\Actions\Admin\Sport\UpdateSportMenuItemAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Sport\ReorderSportMenuItemsRequest;
use App\Http\Requests\Admin\Sport\StoreSportMenuItemRequest;
use App\Http\Requests\Admin\Sport\UpdateSportMenuItemRequest;
use App\Models\SportMenuItem;
use Illuminate\Http\JsonResponse;

class SportMenuItemController extends Controller
{
    public function index(ListSportMenuItemsAction $action): JsonResponse
    {
        return $action->handle();
    }

    public function store(StoreSportMenuItemRequest $request, CreateSportMenuItemAction $action): JsonResponse
    {
        return $action->handle($request->validated());
    }

    public function update(UpdateSportMenuItemRequest $request, SportMenuItem $sportMenuItem, UpdateSportMenuItemAction $action): JsonResponse
    {
        return $action->handle($sportMenuItem, $request->validated());
    }

    public function destroy(SportMenuItem $sportMenuItem, DeleteSportMenuItemAction $action): JsonResponse
    {
        return $action->handle($sportMenuItem);
    }

    public function reorder(ReorderSportMenuItemsRequest $request, ReorderSportMenuItemsAction $action): JsonResponse
    {
        return $action->handle($request->validated()['ids']);
    }
}
