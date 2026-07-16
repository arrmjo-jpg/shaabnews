<?php

declare(strict_types=1);

namespace App\Events\Content;

use App\Enums\VideoStatus;
use App\Models\User;
use App\Models\Video;

/**
 * يُصدَر بعد commit ناجح لانتقال حالة فيديو (TransitionVideoStatusAction) —
 * مرآة ArticleStatusChanged (Task 6b). غلاف حول الآثار الجانبية القائمة
 * (كاش/CDN-تجديد/إشعار) — لا يغيّر توقيتها. مستمعوه متزامنون عمداً؛ راجع
 * docs/architecture/DOMAIN-EVENTS.md.
 */
final class VideoStatusChanged
{
    public function __construct(
        public readonly Video $video,
        public readonly VideoStatus $from,
        public readonly VideoStatus $to,
        public readonly User $actor,
    ) {}
}
