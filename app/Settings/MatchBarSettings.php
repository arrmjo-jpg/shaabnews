<?php

declare(strict_types=1);

namespace App\Settings;

/**
 * إعداد شريط المباريات على مستوى الموقع — مفتاح تفعيل/تعطيل واحد فقط. أيّ بطولة تظهر
 * أو تُخفى إنّما يُقرَّر عبر Competition::show_in_match_bar (راجع BuildCompetitionBarAction)،
 * لا عبر إعداد هنا.
 */
class MatchBarSettings extends BarSettings
{
    public static function group(): string
    {
        return 'match_bar';
    }
}
