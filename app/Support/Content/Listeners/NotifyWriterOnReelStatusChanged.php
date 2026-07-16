<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\ReelStatusChanged;
use App\Support\Notifications\WriterNotifier;

/**
 * نفس النداء الذي كان داخل TransitionReelStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (Task 6b، مرآة ADR-E2).
 */
final class NotifyWriterOnReelStatusChanged
{
    public function handle(ReelStatusChanged $event): void
    {
        WriterNotifier::contentStatusChanged($event->reel, 'reel', $event->to->value);
    }
}
