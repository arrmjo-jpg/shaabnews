<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Public\Sport\ListPublicSportMenuAction;
use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SportMenuController extends Controller
{
    public function index(Request $request, ListPublicSportMenuAction $action): JsonResponse
    {
        $locale = (string) $request->query('locale', 'ar');
        if (! in_array($locale, Category::LOCALES, true)) {
            $locale = 'ar';
        }

        return $action->handle($locale);
    }
}
