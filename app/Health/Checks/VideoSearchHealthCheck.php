<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Enums\VideoStatus;
use App\Enums\VideoVisibility;
use App\Models\Video;

/** صحّة فهرس بحث الفيديوهات — المتوقَّع يطابق Video::shouldBeSearchable() فعليًّا. */
class VideoSearchHealthCheck extends ContentSearchHealthCheck
{
    protected function indexName(): string
    {
        return 'videos_index';
    }

    protected function expectedSearchableCount(): int
    {
        return Video::query()
            ->where('status', VideoStatus::Published)
            ->where('visibility', VideoVisibility::Public)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->count();
    }

    protected function recoveryCommandHint(): string
    {
        return 'php artisan search:reindex video --fresh';
    }
}
