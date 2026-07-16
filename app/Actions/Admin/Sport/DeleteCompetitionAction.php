<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Models\Competition;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class DeleteCompetitionAction
{
    public function handle(Competition $competition): JsonResponse
    {
        $competition->delete();

        return ApiResponse::success(__('sport.competition_deleted'));
    }
}
