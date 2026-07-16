<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\VideoStatusChanged;
use App\Support\Cache\VideoCacheTags;
use Illuminate\Support\Facades\Cache;

/**
 * نفس النداء الذي كان داخل TransitionVideoStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (Task 6b، مرآة ADR-E2).
 */
final class InvalidateVideoCacheOnStatusChanged
{
    public function handle(VideoStatusChanged $event): void
    {
        $video = $event->video;
        $video->load('category');
        Cache::tags(VideoCacheTags::invalidationTags($video, categorySlug: $video->category?->slug))->flush();
    }
}
