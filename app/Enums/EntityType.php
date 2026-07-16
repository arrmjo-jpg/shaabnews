<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * نوع الكيان المعرفيّ — سجلّ مُغلَق (Phase 1: توسيم يدويّ فقط، انظر
 * docs/adr/E5-entity-registry-not-tags.md).
 *
 * - person      : شخص (سياسيّ، فنّان، رياضيّ...)
 * - organization: منظّمة/شركة/جهة رسميّة
 * - place       : مكان جغرافيّ
 * - topic       : موضوع/قضيّة متكرّرة عابرة للأقسام (ليس قسمًا تحريريًّا —
 *   القسم تصنيف ملاحة إداريّ، هذا معنى دلاليّ عابر. قارن Category::class)
 *
 * نوع تكهّنيّ مؤجَّل عمداً: event (كأس العالم/الانتخابات/رمضان) — يُضاف عند
 * وصول Phase 4 (صفحات المواضيع) لا قبله، تماشياً مع نهج ArticleType في رفض
 * الأنواع التخمينية قبل أوانها.
 */
enum EntityType: string
{
    case Person = 'person';
    case Organization = 'organization';
    case Place = 'place';
    case Topic = 'topic';

    /** @return array<int,string> */
    public static function values(): array
    {
        return array_map(fn (self $c): string => $c->value, self::cases());
    }
}
