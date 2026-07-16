<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Enums\BroadcastStatus;
use App\Models\Broadcast;

/** صحّة فهرس بحث البثّ — المتوقَّع يطابق Broadcast::shouldBeSearchable() فعليًّا. */
class BroadcastSearchHealthCheck extends ContentSearchHealthCheck
{
    protected function indexName(): string
    {
        return 'broadcasts_index';
    }

    protected function expectedSearchableCount(): int
    {
        return Broadcast::query()
            ->where('is_public', true)
            ->whereIn('status', [BroadcastStatus::Live, BroadcastStatus::Ended])
            ->count();
    }

    protected function recoveryCommandHint(): string
    {
        return 'php artisan search:reindex broadcast --fresh';
    }
}
