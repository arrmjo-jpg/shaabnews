<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public\Content;

use App\Actions\Public\Content\ListPublicCategoriesAction;
use App\Actions\Public\Content\ShowPublicCategoryAction;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(string $locale): JsonResponse
    {
        return (new ListPublicCategoriesAction)->handle($locale);
    }

    /** $path: مقطع slug مفرد أو سلسلة مقاطع متداخلة مفصولة بـ«/» (2026-07-18). */
    public function show(string $locale, string $path): JsonResponse
    {
        return (new ShowPublicCategoryAction)->handle($locale, $path);
    }
}
