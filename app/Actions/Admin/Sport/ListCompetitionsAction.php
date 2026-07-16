<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\CompetitionResource;
use App\Models\Competition;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/** قائمة البطولات الكاملة — حجم متوقَّع صغير (عشرات)، فلا حاجة لترقيم صفحات. */
final class ListCompetitionsAction
{
    public function handle(): JsonResponse
    {
        $competitions = Competition::query()->orderBy('name')->get();

        return ApiResponse::success(data: CompetitionResource::collection($competitions));
    }
}
