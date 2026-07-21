<?php

declare(strict_types=1);

namespace App\Settings;

/**
 * إعداد شريط الصفحة الرئيسية للرياضة — مفتاح تفعيل/تعطيل واحد فقط، مستقلّ تمامًا عن
 * MatchBarSettings. أيّ بطولة تظهر أو تُخفى إنّما يُقرَّر عبر Competition::show_in_sports_home_bar
 * (راجع BuildCompetitionBarAction)، لا عبر إعداد هنا.
 */
class SportsHomeBarSettings extends BarSettings
{
    public static function group(): string
    {
        return 'sports_home_bar';
    }
}
