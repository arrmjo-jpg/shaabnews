<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Http\Resources\Public\Content\PublicArticleListItemResource;
use App\Models\Article;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CachedRead;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Content\CdnTtl;
use App\Support\Responses\ApiResponse;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * الأكثر قراءة — ترتيب حقيقي بعدد المشاهدات المُتتبَّعة (engagement_counters.views،
 * نفس مصدر التفاعل الموحّد، لا عدّاد موازٍ). كاسر تعادل بالتفاعل الحقيقيّ
 * (likes+favorites) ثمّ التاريخ — يمنع انهيار القائمة إلى «آخر الأخبار» حين تكون
 * المشاهدات متساوية/صفراً، ببيانات صادقة لا مُلفّقة. نافذة زمنية اختيارية (?days=)
 * تقصر النتائج على المنشور حديثاً (افتراضي: كل الأوقات).
 *
 * قابل للتوسّع: عدّاد مُجمَّع (لا COUNT وقت التشغيل) + كاش feed(locale) قصير. آمن
 * ضدّ الإساءة: المشاهدات تُسجَّل عبر EngagementService (منع تكرار 30د لكل فاعل).
 */
class ListMostReadArticlesAction
{
    private const DEFAULT_LIMIT = 10;

    private const MAX_LIMIT = 50;

    public function handle(string $locale, Request $request): JsonResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $limit = max(1, min((int) $request->integer('per_page', self::DEFAULT_LIMIT), self::MAX_LIMIT));
        $days = max(0, min((int) $request->integer('days', 0), 90)); // 0 = كل الأوقات

        $data = CachedRead::remember(
            ArticleCacheTags::feedTags($locale),
            CacheKeys::publicArticlesMostRead($locale, $limit, $days),
            CacheTtl::REALTIME,
            fn (): array => PublicArticleListItemResource::collection($this->query($locale, $limit, $days))->resolve(),
        );

        return ApiResponse::success(data: $data)
            ->header('Cache-Control', CdnTtl::breaking()); // قائمة متغيّرة — TTL قصير
    }

    /**
     * استعلام بمرحلتين (أداء — تدقيق 2026-06): الفرز محسوب (COALESCE) فلا فهرس يخدمه، وكان سحب
     * `articles.*` (بالمحتوى) لعشرات الآلاف إلى جدول الفرز المؤقّت يكلّف ~5.6s. المرحلة 1 تفرز
     * **ids فقط** بنفس الفلاتر والترتيب حرفيًّا (تعابير خام مكافئة للأسماء المستعارة السابقة)،
     * والمرحلة 2 تجلب الصفوف الكاملة بالـids وتعيد ترتيبها. صفر تغيير في الدلالة/العقد/الـJSON.
     *
     * @return Collection<int,Article>
     */
    private function query(string $locale, int $limit, int $days): Collection
    {
        $morph = (new Article)->getMorphClass();

        // 1. Fetch top viewed articles via inner join (uses composite index on engagement_counters)
        $viewedIds = Article::query()
            ->published()
            ->forLocale($locale)
            ->when($days > 0, fn ($q) => $q->where('articles.published_at', '>=', now()->subDays($days)))
            ->join('engagement_counters', function ($join) use ($morph): void {
                $join->on('engagement_counters.engageable_id', '=', 'articles.id')
                    ->where('engagement_counters.engageable_type', '=', $morph);
            })
            ->orderByDesc('engagement_counters.views')
            ->orderByRaw('(engagement_counters.likes + engagement_counters.favorites) DESC')
            ->orderByDesc('articles.published_at')
            ->limit($limit)
            ->pluck('articles.id')
            ->all();

        $ids = $viewedIds;
        $needed = $limit - count($ids);

        if ($needed > 0) {
            // 2. Fetch latest published articles to fill remaining slots (equivalent to 0 views fallback)
            $latestIds = Article::query()
                ->published()
                ->forLocale($locale)
                ->when($days > 0, fn ($q) => $q->where('published_at', '>=', now()->subDays($days)))
                ->when($ids !== [], fn ($q) => $q->whereNotIn('id', $ids))
                ->orderByDesc('published_at')
                ->limit($needed)
                ->pluck('id')
                ->all();

            $ids = array_merge($ids, $latestIds);
        }

        if ($ids === []) {
            return new Collection;
        }

        $order = array_flip($ids);

        return Article::query()
            ->select([
                'id', 'author_id', 'primary_category_id', 'type', 'status', 'locale',
                'title', 'subtitle', 'slug', 'excerpt', 'published_at',
                'is_featured', 'is_breaking', 'is_pinned', 'is_header', 'is_editor_pick', 'is_squares',
                'views_count', 'event_status', 'created_at', 'deleted_at',
            ])
            ->published()
            ->forLocale($locale)
            ->whereIn('articles.id', $ids)
            ->with([
                'author:id,name,avatar,is_writer',
                'primaryCategory:id,name,slug',
                'mediaAssets' => fn ($q) => $q->wherePivot('collection', 'cover'),
            ])
            ->get()
            ->sortBy(fn (Article $a): int => $order[$a->id] ?? PHP_INT_MAX)
            ->values();
    }
}
