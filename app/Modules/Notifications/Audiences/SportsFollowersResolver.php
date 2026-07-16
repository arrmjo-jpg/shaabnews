<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Audiences;

use App\Models\Follow;
use App\Models\User;
use App\Modules\Notifications\Enums\AudienceType;
use App\Modules\Notifications\Support\AudienceResult;
use Illuminate\Database\Eloquent\Builder;

/** متابعو الرياضة: مستخدمون نشطون لهم متابعة واحدة على الأقلّ (عبر subquery — لا materialization). */
final class SportsFollowersResolver extends AbstractAudienceResolver
{
    public function type(): AudienceType
    {
        return AudienceType::SportsFollowers;
    }

    public function describe(array $params): AudienceResult
    {
        return AudienceResult::cohort(AudienceType::SportsFollowers, []);
    }

    public function userQuery(AudienceResult $audience): ?Builder
    {
        return $this->base();
    }

    /** @return Builder<User> */
    private function base(): Builder
    {
        return $this->activeUsers()->whereIn('id', Follow::query()->select('user_id'));
    }
}
