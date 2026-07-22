<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\ArticleStatusChanged;
use App\Support\Content\ArticleCdnPurge;

/**
 * نفس النداء الذي كان داخل TransitionArticleStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (ADR-E2). يعيش خارج app/Listeners عمداً — راجع
 * InvalidateArticleCacheOnStatusChanged للسبب (تجنّب الاكتشاف الذاتي المزدوج).
 *
 * يمرّر $event->oldPath (2026-07-18) — مطلوب الآن لأن انتقال الحالة قد يغيّر
 * published_at (draft→scheduled)، والمسار القانوني الجديد يُضمِّن التاريخ.
 */
final class PurgeArticleCdnOnStatusChanged
{
    public function handle(ArticleStatusChanged $event): void
    {
        ArticleCdnPurge::purge($event->article, $event->oldPath);
    }
}
