<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Audiences;

use App\Models\User;
use App\Modules\Notifications\Enums\AudienceType;
use App\Modules\Notifications\Support\AudienceResult;
use Illuminate\Database\Eloquent\Builder;

/**
 * مشتركو واتساب: مستخدمون مُفعِّلون whatsapp_subscribed (مرآة الموافقة). قناة WhatsApp في طورها
 * تحلّ المستلمين من whatsapp_contacts (SSoT)؛ هذا المسار user-based للتجريد المحايد.
 */
final class WhatsappSubscribersResolver extends AbstractAudienceResolver
{
    public function type(): AudienceType
    {
        return AudienceType::WhatsappSubscribers;
    }

    public function describe(array $params): AudienceResult
    {
        return AudienceResult::cohort(AudienceType::WhatsappSubscribers, []);
    }

    public function userQuery(AudienceResult $audience): ?Builder
    {
        return $this->base();
    }

    /** @return Builder<User> */
    private function base(): Builder
    {
        return $this->activeUsers()->where('whatsapp_subscribed', true);
    }
}
