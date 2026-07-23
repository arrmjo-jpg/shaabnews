<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * القيم المعترف بها لـ SportMenuItem::section_key (Governance فقط — Sprint 1.6 Phase 3.2 Commit 2).
 *
 * هذا Enum لا يُثبت وجود Route/Provider/صفحة فعلية لأيّ قيمة — يُقيِّد فقط ما يُسمح للإدارة
 * بإدخاله. توفّر الصفحة (Availability) مسؤولية منفصلة كليًّا تُحسَم في طبقة العرض العامّة
 * (SECTION_ROUTES في sport-primary-nav.tsx) — عنصر بقيمة معترف بها هنا قد يبقى مخفيًّا هناك
 * إن لم توجد له صفحة بعد (predictions مثال حاليّ). القراران مستقلّان عمدًا: توسيع هذا الـEnum
 * لا يُظهر شيئًا في الواجهة العامة تلقائيًّا، وحذف قيمة منه لا علاقة له بحذف صفحة.
 */
enum SportMenuSectionKey: string
{
    case Matches = 'matches';
    case Results = 'results';
    case Competitions = 'competitions';
    case Teams = 'teams';
    case Players = 'players';
    case Predictions = 'predictions';

    /** @return array<int,string> */
    public static function values(): array
    {
        return array_map(fn (self $c): string => $c->value, self::cases());
    }
}
