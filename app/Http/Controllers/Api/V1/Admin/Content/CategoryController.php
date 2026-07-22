<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Content;

use App\Actions\Admin\Content\BulkUpdateCategoriesAction;
use App\Actions\Admin\Content\CreateCategoryAction;
use App\Actions\Admin\Content\DeleteCategoryAction;
use App\Actions\Admin\Content\ForceDeleteCategoryAction;
use App\Actions\Admin\Content\ListCategoriesAction;
use App\Actions\Admin\Content\ListTrashedCategoriesAction;
use App\Actions\Admin\Content\MoveCategoryAction;
use App\Actions\Admin\Content\RestoreCategoryAction;
use App\Actions\Admin\Content\UpdateCategoryAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Content\BulkUpdateCategoriesRequest;
use App\Http\Requests\Admin\Content\MoveCategoryRequest;
use App\Http\Requests\Admin\Content\StoreCategoryRequest;
use App\Http\Requests\Admin\Content\UpdateCategoryRequest;
use App\Http\Resources\Admin\Content\CategoryResource;
use App\Models\Category;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return (new ListCategoriesAction)->handle();
    }

    public function show(Category $category): JsonResponse
    {
        return ApiResponse::success(
            data: new CategoryResource($category->load(['children', 'bannerMedia']))
        );
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        return (new CreateCategoryAction)->handle($request->validated());
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        return (new UpdateCategoryAction)->handle($category, $request->validated());
    }

    public function destroy(Category $category): JsonResponse
    {
        return (new DeleteCategoryAction)->handle($category);
    }

    public function trashed(): JsonResponse
    {
        return (new ListTrashedCategoriesAction)->handle();
    }

    public function restore(Category $category): JsonResponse
    {
        return (new RestoreCategoryAction)->handle($category);
    }

    public function forceDelete(Category $category): JsonResponse
    {
        return (new ForceDeleteCategoryAction)->handle($category);
    }

    public function move(MoveCategoryRequest $request, Category $category): JsonResponse
    {
        return (new MoveCategoryAction)->handle($category, $request->validated('direction'));
    }

    public function bulkUpdate(BulkUpdateCategoriesRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $ids = $validated['ids'];
        unset($validated['ids']);

        return (new BulkUpdateCategoriesAction)->handle($ids, $validated);
    }
}
