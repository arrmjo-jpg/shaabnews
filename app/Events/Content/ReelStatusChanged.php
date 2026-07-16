<?php

declare(strict_types=1);

namespace App\Events\Content;

use App\Enums\ReelStatus;
use App\Models\Reel;
use App\Models\User;

/**
 * يُصدَر بعد commit ناجح لانتقال حالة ريل (TransitionReelStatusAction) —
 * مرآة ArticleStatusChanged (Task 6b). غلاف حول الآثار الجانبية القائمة
 * (كاش/CDN/إشعار) — لا يغيّر توقيتها. مستمعوه متزامنون عمداً؛ راجع
 * docs/architecture/DOMAIN-EVENTS.md.
 */
final class ReelStatusChanged
{
    public function __construct(
        public readonly Reel $reel,
        public readonly ReelStatus $from,
        public readonly ReelStatus $to,
        public readonly User $actor,
    ) {}
}
