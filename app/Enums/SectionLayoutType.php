<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * نمط عرض القسم (Section Design System) — يقرأه SectionRenderer في الواجهة العامة
 * لاختيار مكوّن التخطيط المناسب (hero/magazine/featured) أو التصميم الافتراضي القديم.
 */
enum SectionLayoutType: string
{
    case Default = 'default';
    case Hero = 'hero';
    case Magazine = 'magazine';
    case Featured = 'featured';

    /** @return array<int,string> */
    public static function values(): array
    {
        return array_map(fn (self $c): string => $c->value, self::cases());
    }
}
