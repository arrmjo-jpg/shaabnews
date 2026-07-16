<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Enums\ReelStatus;
use App\Models\Reel;

/** صحّة فهرس بحث الريلز — المتوقَّع يطابق Reel::shouldBeSearchable() فعليًّا. */
class ReelSearchHealthCheck extends ContentSearchHealthCheck
{
    protected function indexName(): string
    {
        return 'reels_index';
    }

    protected function expectedSearchableCount(): int
    {
        return Reel::query()
            ->where('status', ReelStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->count();
    }

    protected function recoveryCommandHint(): string
    {
        return 'php artisan search:reindex reel --fresh';
    }
}
