<?php

declare(strict_types=1);

namespace App\Support\Content\Listeners;

use App\Events\Content\ArticleStatusChanged;
use App\Support\Cache\ArticleCacheTags;
use Illuminate\Support\Facades\Cache;

/**
 * نفس السطر الذي كان داخل TransitionArticleStatusAction حرفياً — منقول لا
 * مُعاد تصميمه (ADR-E2).
 *
 * يعيش عمداً خارج app/Listeners (الذي يفحصه Laravel تلقائياً بالاكتشاف
 * الذاتي) — نفس نمط App\Modules\Notifications\Listeners: تسجيل صريح واحد
 * فقط عبر Event::listen في AppServiceProvider، لا تسجيل مزدوج (تلقائي +
 * صريح) يُضاعف التنفيذ.
 */
final class InvalidateArticleCacheOnStatusChanged
{
    public function handle(ArticleStatusChanged $event): void
    {
        Cache::tags(ArticleCacheTags::writeTags($event->article))->flush();
    }
}
