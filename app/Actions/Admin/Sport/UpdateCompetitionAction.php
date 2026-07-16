<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\CompetitionResource;
use App\Models\Competition;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class UpdateCompetitionAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(Competition $competition, array $data): JsonResponse
    {
        $competition->update($data);

        // إبطال فوريّ لشريط المباريات — تفعيل/تعطيل بطولة في الأعلام التحريريّة يظهر أثره
        // دون انتظار انتهاء صلاحية الكاش (لا علاقة لهذا بمزامنة is_tracked — تلك مستقلّة تمامًا).
        FrontendRevalidate::tags(['match-bar']);

        return ApiResponse::success(__('sport.competition_updated'), new CompetitionResource($competition));
    }
}
