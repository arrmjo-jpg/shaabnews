<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Models\Article;

/**
 * صحّة فهرس بحث المقالات (Meilisearch). Article::shouldBeSearchable() = true
 * دائماً (تُفهرَس كل الحالات، والفلترة تقع وقت الاستعلام لا الفهرسة) — لذا
 * المتوقَّع هو كل صفّ غير محذوف، لا فقط المنشور.
 */
class ArticleSearchHealthCheck extends ContentSearchHealthCheck
{
    protected function indexName(): string
    {
        return 'articles_index';
    }

    protected function expectedSearchableCount(): int
    {
        return Article::query()->count();
    }

    protected function recoveryCommandHint(): string
    {
        return 'php artisan search:reindex article --fresh';
    }
}
