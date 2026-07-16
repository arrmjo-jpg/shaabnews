<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\ArticleStatusChanged;
use App\Support\Notifications\WriterNotifier;

/**
 * نفس النداء الذي كان داخل TransitionArticleStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (ADR-E2). يعيش خارج app/Listeners عمداً — راجع
 * InvalidateArticleCacheOnStatusChanged للسبب (تجنّب الاكتشاف الذاتي المزدوج).
 */
final class NotifyWriterOnArticleStatusChanged
{
    public function handle(ArticleStatusChanged $event): void
    {
        WriterNotifier::contentStatusChanged($event->article, 'article', $event->to->value);
    }
}
