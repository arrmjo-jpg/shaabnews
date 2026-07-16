<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Audiences;

use App\Models\User;
use App\Modules\Notifications\Enums\AudienceType;
use App\Modules\Notifications\Support\AudienceResult;
use Illuminate\Database\Eloquent\Builder;

/** مشتركو البريد: مستخدمون نشطون لهم بريد (لا newsletter منفصل — كلّ مستخدم له email). */
final class EmailSubscribersResolver extends AbstractAudienceResolver
{
    public function type(): AudienceType
    {
        return AudienceType::EmailSubscribers;
    }

    public function describe(array $params): AudienceResult
    {
        return AudienceResult::cohort(AudienceType::EmailSubscribers, []);
    }

    public function userQuery(AudienceResult $audience): ?Builder
    {
        return $this->base();
    }

    /** @return Builder<User> */
    private function base(): Builder
    {
        return $this->activeUsers()->whereNotNull('email')->where('email', '!=', '');
    }
}
