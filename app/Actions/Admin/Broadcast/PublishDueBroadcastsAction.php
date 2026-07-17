<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Enums\BroadcastStatus;
use App\Models\Broadcast;
use App\Support\Cache\BroadcastCacheTags;
use App\Support\Frontend\FrontendCacheTags;
use App\Support\Frontend\FrontendRevalidate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * أتمتة بدء البثّ المجدوَل — ينقل scheduled → live عند بلوغ scheduled_at (نفس نمط
 * PublishDueVideosAction). **نطاق-حالة فقط**: لا تشغيل/ترميز/وسيط — البثّ خارجي،
 * فالانتقال يجعل الصفحة العامة تعرض المصدر فحسب.
 *
 * فاعل النظام (updated_by يبقى كما هو). idempotent: شرط WHERE + قفل صفّ + إعادة
 * فحص داخل المعاملة + قفل موزّع يمنع التداخل والاحتساب المزدوج.
 */
final class PublishDueBroadcastsAction
{
    private const LOCK_KEY = 'broadcasts:go-live-due';

    public function handle(): int
    {
        $lock = Cache::lock(self::LOCK_KEY, 110);

        if (! $lock->get()) {
            return 0; // تشغيل آخر جارٍ — تخطٍّ آمن
        }

        $published = 0;

        /** @var array<int, Broadcast> $purgeQueue */
        $purgeQueue = [];

        try {
            Broadcast::query()
                ->where('status', BroadcastStatus::Scheduled->value)
                ->whereNotNull('scheduled_at')
                ->where('scheduled_at', '<=', now())
                ->orderBy('id')
                ->chunkById(100, function ($chunk) use (&$published, &$purgeQueue): void {
                    foreach ($chunk as $broadcast) {
                        $live = DB::transaction(function () use ($broadcast): ?Broadcast {
                            $fresh = Broadcast::query()
                                ->whereKey($broadcast->id)
                                ->lockForUpdate()
                                ->first();

                            if ($fresh === null
                                || $fresh->status !== BroadcastStatus::Scheduled
                                || $fresh->scheduled_at === null
                                || $fresh->scheduled_at->isFuture()) {
                                return null; // idempotent: تغيّرت الحالة/الوقت
                            }

                            // حارس آلة الحالة (scheduled → live مسموح) — دفاع عميق.
                            if (! $fresh->status->canTransitionTo(BroadcastStatus::Live)) {
                                return null;
                            }

                            $fresh->status = BroadcastStatus::Live->value;
                            $fresh->started_at = $fresh->started_at ?? now();
                            $fresh->save();

                            return $fresh;
                        });

                        if ($live !== null) {
                            $published++;
                            $purgeQueue[] = $live;
                        }
                    }
                });
        } finally {
            $lock->release();
        }

        if ($published > 0) {
            $tags = [];
            $frontendTags = [];
            foreach ($purgeQueue as $broadcast) {
                $broadcast->loadMissing('category');
                $tags = array_merge($tags, BroadcastCacheTags::invalidationTags(
                    $broadcast,
                    categorySlug: $broadcast->category?->slug,
                ));
                $frontendTags = array_merge($frontendTags, FrontendCacheTags::broadcast($broadcast));
            }
            Cache::tags(array_values(array_unique($tags)))->flush();
            FrontendRevalidate::tags(array_values(array_unique($frontendTags)));
        }

        return $published;
    }
}
