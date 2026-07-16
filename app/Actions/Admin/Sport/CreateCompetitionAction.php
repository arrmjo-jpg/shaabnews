<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\CompetitionResource;
use App\Models\Competition;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class CreateCompetitionAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(array $data): JsonResponse
    {
        $competition = Competition::create($data);

        return ApiResponse::success(__('sport.competition_created'), new CompetitionResource($competition), 201);
    }
}
