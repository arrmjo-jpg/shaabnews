<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * مصدر شريط المباريات — قيمة واحدة حصريّة، لا وضع دمج. تبديل القيمة يستبدل السابقة تلقائيًّا
 * (راجع MatchBarSettings + BuildMatchBarAction).
 */
enum MatchBarSource: string
{
    case Disabled = 'disabled';
    case FeaturedCompetitions = 'featured_competitions';
    case RegularLeagues = 'regular_leagues';

    /** @return array<int,string> */
    public static function values(): array
    {
        return array_map(fn (self $s): string => $s->value, self::cases());
    }
}
