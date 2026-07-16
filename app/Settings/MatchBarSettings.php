<?php

declare(strict_types=1);

namespace App\Settings;

use Spatie\LaravelSettings\Settings;

/**
 * إعداد شريط المباريات على مستوى الموقع. القيمة الخام (string) تُطابَق MatchBarSource
 * عند القراءة — راجع BuildMatchBarAction. لا تخزين مباشر للـenum هنا لتفادي أيّ تعقيد في
 * تحويل Spatie Settings؛ التحقّق من القيم المسموحة يقع في UpdateMatchBarSettingsRequest.
 */
class MatchBarSettings extends Settings
{
    public string $source;

    public static function group(): string
    {
        return 'match_bar';
    }
}
