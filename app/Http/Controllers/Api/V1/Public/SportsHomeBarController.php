<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Public\Sport\BuildCompetitionBarAction;
use App\Http\Controllers\Controller;
use App\Settings\SportsHomeBarSettings;
use Illuminate\Http\JsonResponse;

class SportsHomeBarController extends Controller
{
    public function show(BuildCompetitionBarAction $action): JsonResponse
    {
        return $action->handle(
            enabled: app(SportsHomeBarSettings::class)->enabled,
            selectedColumn: 'show_in_sports_home_bar',
            sortColumn: 'sports_home_bar_sort_order',
        );
    }
}
