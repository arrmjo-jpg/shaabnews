<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Enums\EpaperStatus;
use App\Models\Epaper;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * نشر الأعداد المُجدوَلة المستحقّة (published_at <= now) — حتميّ، مقفول، idempotent.
 * قفل توزيع يمنع التنفيذ المتزامن؛ lockForUpdate لكل صفّ يمنع النشر المزدوج؛ يتحقّق
 * من بقاء الشروط (مجدوَل + مستحقّ + له PDF) قبل النشر. مرآة PublishDueVideosAction.
 */
final class PublishDueEpapersAction
{
    private const LOCK_KEY = 'epapers:publish-due';

    public function handle(): int
    {
        $lock = Cache::lock(self::LOCK_KEY, 110);
        if (! $lock->get()) {
            return 0;
        }

        $published = 0;

        /** @var array<int, Epaper> $purgeQueue */
        $purgeQueue = [];

        try {
            Epaper::query()
                ->where('status', EpaperStatus::Scheduled->value)
                ->whereNotNull('published_at')
                ->where('published_at', '<=', now())
                ->orderBy('id')
                ->chunkById(100, function ($chunk) use (&$published, &$purgeQueue): void {
                    foreach ($chunk as $epaper) {
                        $fresh = DB::transaction(function () use ($epaper): ?Epaper {
                            $fresh = Epaper::query()->whereKey($epaper->id)->lockForUpdate()->first();

                            if ($fresh === null
                                || $fresh->status !== EpaperStatus::Scheduled
                                || $fresh->published_at === null
                                || $fresh->published_at->isFuture()
                                || $fresh->media_asset_id === null) {
                                return null;
                            }

                            $fresh->status = EpaperStatus::Published->value;
                            $fresh->save();

                            return $fresh;
                        });

                        if ($fresh !== null) {
                            $published++;
                            $purgeQueue[] = $fresh;
                        }
                    }
                });
        } finally {
            $lock->release();
        }

        if ($published > 0) {
            $frontendTags = [];
            foreach ($purgeQueue as $epaper) {
                $frontendTags = array_merge($frontendTags, FrontendCacheTags::epaper($epaper));
            }
            FrontendRevalidate::tags(array_values(array_unique($frontendTags)));
        }

        return $published;
    }
}
