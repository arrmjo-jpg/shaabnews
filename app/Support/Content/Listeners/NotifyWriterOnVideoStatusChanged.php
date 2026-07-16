<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\VideoStatusChanged;
use App\Support\Notifications\WriterNotifier;

/**
 * نفس النداء الذي كان داخل TransitionVideoStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (Task 6b).
 */
final class NotifyWriterOnVideoStatusChanged
{
    public function handle(VideoStatusChanged $event): void
    {
        WriterNotifier::contentStatusChanged($event->video, 'video', $event->to->value);
    }
}
