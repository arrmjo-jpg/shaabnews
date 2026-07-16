<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Enums\VideoStatus;
use App\Events\Content\VideoStatusChanged;
use App\Support\Cache\VideoCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Seo\SearchEngineNotify;

/**
 * نفس النداءين اللذين كانا داخل TransitionVideoStatusAction حرفياً — منقولان
 * لا مُعاد تصميمهما (Task 6b). Video لا يملك CdnPurge مخصّصة (خلافاً لـ
 * Article/Reel) — فجوة موثّقة منفصلة، غير مُصلَحة هنا عمداً.
 */
final class RevalidateVideoFrontendOnStatusChanged
{
    public function handle(VideoStatusChanged $event): void
    {
        $video = $event->video;
        $video->load('category');
        $tags = VideoCacheTags::invalidationTags($video, categorySlug: $video->category?->slug);
        FrontendRevalidate::tags(FrontendCacheTags::fromVideoTags($tags));

        if ($event->to === VideoStatus::Published) {
            SearchEngineNotify::sitemaps();
        }
    }
}
