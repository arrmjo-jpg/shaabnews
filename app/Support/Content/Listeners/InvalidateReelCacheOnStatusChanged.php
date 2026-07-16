<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\ReelStatusChanged;
use App\Support\Cache\ReelCacheTags;
use Illuminate\Support\Facades\Cache;

/**
 * نفس النداء الذي كان داخل TransitionReelStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (Task 6b، مرآة ADR-E2).
 */
final class InvalidateReelCacheOnStatusChanged
{
    public function handle(ReelStatusChanged $event): void
    {
        Cache::tags(ReelCacheTags::invalidationTags($event->reel))->flush();
    }
}
