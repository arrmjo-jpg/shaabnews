<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Notifications\Enums\ChannelKey;
use App\Modules\Notifications\Support\AudienceResult;
use App\Modules\Notifications\Support\RecipientBatch;

/**
 * مُجسِّر قناة — يحوّل AudienceResult (سبيك محايد) إلى RecipientBatch خاصّ بالقناة. **channel-aware**
 * (يعرف عنونة قناته) بينما الـResolvers channel-agnostic. يبثّ الدفعات كـGenerator (chunkById →
 * RecipientBatch) فلا يُحمَّل جمهور كبير في الذاكرة.
 */
interface ChannelBinder
{
    public function channel(): ChannelKey;

    /**
     * @return iterable<RecipientBatch> دفعات (topic واحدة أو tokens مُجزّأة)
     */
    public function bind(AudienceResult $audience): iterable;
}
