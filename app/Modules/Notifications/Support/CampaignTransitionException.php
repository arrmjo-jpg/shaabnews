<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use DomainException;

/**
 * انتقال حالة حملة غير مسموح أو فاشل بسبب سباق (claimed=0). يُحوَّل في الـController إلى 409.
 */
final class CampaignTransitionException extends DomainException {}
