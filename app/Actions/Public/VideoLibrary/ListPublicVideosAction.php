<?php

declare(strict_types=1);

namespace App\Actions\Public\VideoLibrary;

use App\Enums\VideoStatus;
use App\Enums\VideoVisibility;
use App\Http\Resources\Public\VideoLibrary\PublicVideoCardResource;
use App\Models\Video;
use App\Models\VideoCategory;
use App\Support\Cache\CachedRead;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Cache\VideoCacheTags;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة فيديوهات المكتبة العامة — عام + قابل للتشغيل فقط، بادئة locale، مرشّحات
 * allow-list (q/category-slug/source_type). كاش single-flight (CachedRead) ضدّ
 * عاصفة الطوابير، وترقيم offset (افتراضي) أو cursor (?paginate=cursor) لخلاصات
 * الجوّال (تمرير لا نهائي ثابت بلا COUNT/إزاحة). يتوافق بنيوياً مع بحث Scout القادم.
 */
class ListPublicVideosAction
{
    /** سقف معرّفات البحث من Scout قبل التقييد بالـ SQL (يطابق نمط المقالات). */
    private const SEARCH_LIMIT = 500;

    public function handle(string $locale, Request $request): JsonResponse
    {
        if (! in_array($locale, Video::LOCALES, true)) {
            return ApiResponse::error(__('video.invalid_locale'), [], 422);
        }

        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) $request->integer('per_page', $default), $max));
        $page = max(1, (int) $request->integer('page', 1));
        $cursorMode = $request->query('paginate') === 'cursor';
        $effectiveQ = $this->normalizeQ($request);

        $queryHash = $this->hashQuery($request, $effectiveQ, $perPage, $page, $cursorMode);

        $payload = CachedRead::remember(
            VideoCacheTags::feedTags($locale),
            CacheKeys::publicVideosList($locale, $queryHash),
            CacheTtl::REALTIME,
            fn (): array => $this->build($locale, $request, $effectiveQ, $perPage, $cursorMode)
        );

        return ApiResponse::success(
            data: $payload['data'],
            meta: $cursorMode ? ['cursor' => $payload['cursor']] : ['pagination' => $payload['pagination']]
        );
    }

    /** @return array<string,mixed> */
    private function build(string $locale, Request $request, string $effectiveQ, int $perPage, bool $cursorMode): array
    {
        $isCollection = config('scout.driver') === 'collection';
        $categoryFilter = (string) ($request->query('filter')['category'] ?? '');
        $sourceTypeFilter = (string) ($request->query('filter')['source_type'] ?? '');

        // إذا كان هناك نص بحث، نستخدم Meilisearch ونمطه الأصلي في الترقيم والفرز بالصلة
        if ($effectiveQ !== '' && ! $cursorMode) {
            try {
                $search = Video::search($effectiveQ)
                    ->where('status', VideoStatus::Published->value)
                    ->where('visibility', VideoVisibility::Public->value)
                    ->where('locale', $locale);

                // تطبيق مرشحات التصفية الخاصة بمكتبة الفيديوهات داخل Meilisearch
                $categoryId = null;
                if ($categoryFilter !== '') {
                    $category = VideoCategory::where('slug', $categoryFilter)->first();
                    if ($category) {
                        $categoryId = $category->id;
                        if (! $isCollection) {
                            $search->where('video_category_id', $category->id);
                        }
                    } else {
                        $categoryId = -1;
                        if (! $isCollection) {
                            $search->where('video_category_id', -1);
                        }
                    }
                }

                if ($sourceTypeFilter !== '' && ! $isCollection) {
                    $search->where('source_type', $sourceTypeFilter);
                }

                // الحماية المزدوجة (Double Security): نقيد تحميل النماذج بقوانين النشر وسرية البيانات والأقسام من MySQL
                $search->query(fn ($q) => $q->public()
                    ->playable()
                    ->forLocale($locale)
                    ->with(['mediaAsset', 'category', 'engagementCounter'])
                    ->when($categoryId !== null, function ($q) use ($categoryId) {
                        $q->where('video_category_id', $categoryId);
                    })
                    ->when($sourceTypeFilter !== '', function ($q) use ($sourceTypeFilter) {
                        $q->where('source_type', $sourceTypeFilter);
                    })
                );

                $paginator = $search->paginate($perPage)->appends($request->query());

                return [
                    'data' => PublicVideoCardResource::collection($paginator)->resolve(),
                    'pagination' => [
                        'total' => $paginator->total(),
                        'count' => $paginator->count(),
                        'per_page' => $paginator->perPage(),
                        'current_page' => $paginator->currentPage(),
                        'total_pages' => $paginator->lastPage(),
                    ],
                ];
            } catch (\Throwable $e) {
                // تدهور رشيق: نرجع للبحث عبر قاعدة البيانات مباشرة في حال تعطل محرك البحث
                report($e);
            }
        }

        // المسار الافتراضي بدون بحث (أو كحالة تراجع في حال تعطل Meilisearch)
        $query = QueryBuilder::for(
            Video::query()
                ->public()
                ->playable()
                ->forLocale($locale)
                ->with(['mediaAsset', 'category', 'engagementCounter'])
        )
            ->allowedFilters(
                // النصّ مُطبَّع مسبقاً (≥ حرفين، مقصوص). بحث عبر Scout/Meilisearch
                // (متن كامل + تسامح أخطاء) ثم تقييد بالـ SQL (locale + public + playable
                // + بقية الفلاتر) عبر whereIn — الثوابت العامة تبقى مفروضة على القراءة.
                AllowedFilter::callback('q', function ($q) use ($effectiveQ): void {
                    if ($effectiveQ === '') {
                        return;
                    }
                    $q->where('title', 'like', '%'.$effectiveQ.'%');
                }),
                AllowedFilter::callback('category', function ($q, $value): void {
                    $q->whereHas('category', fn ($c) => $c->where('slug', $value));
                }),
                AllowedFilter::exact('source_type'),
            );

        // cursor: ترتيب ثابت (published_at + id كفاصل) — لا COUNT ولا إزاحة عناصر.
        if ($cursorMode) {
            $paginator = $query
                ->orderByDesc('published_at')
                ->orderByDesc('id')
                ->cursorPaginate($perPage)
                ->withQueryString();

            return [
                'data' => PublicVideoCardResource::collection($paginator)->resolve(),
                'cursor' => [
                    'per_page' => $paginator->perPage(),
                    'next_cursor' => $paginator->nextCursor()?->encode(),
                    'prev_cursor' => $paginator->previousCursor()?->encode(),
                    'has_more' => $paginator->hasMorePages(),
                ],
            ];
        }

        $paginator = $query
            ->allowedSorts('published_at', 'views_count')
            ->defaultSort('-published_at')
            ->paginate($perPage)
            ->appends($request->query());

        return [
            'data' => PublicVideoCardResource::collection($paginator)->resolve(),
            'pagination' => [
                'total' => $paginator->total(),
                'count' => $paginator->count(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'total_pages' => $paginator->lastPage(),
            ],
        ];
    }

    private function hashQuery(Request $request, string $effectiveQ, int $perPage, int $page, bool $cursorMode): string
    {
        $filter = $request->query('filter');
        $filter = is_array($filter) ? $filter : [];

        $relevant = [
            'page' => $page,
            'per_page' => $perPage,
            'paginate' => $cursorMode ? 'cursor' : '',
            'cursor' => (string) $request->query('cursor', ''),
            'sort' => (string) $request->query('sort', ''),
            // النصّ المُطبَّع (لا الخام) — تتلاشى المتغيّرات القصيرة/الفارغة لمفتاح واحد.
            'filter.q' => $effectiveQ,
            'filter.category' => (string) ($filter['category'] ?? ''),
            'filter.source_type' => (string) ($filter['source_type'] ?? ''),
        ];
        ksort($relevant);

        return substr(hash('xxh128', json_encode($relevant, JSON_THROW_ON_ERROR)), 0, 16);
    }

    /**
     * يطبّع نص البحث: تشذيب + حدّ أدنى حرفين (وإلا يُتجاهَل) + سقف 100 حرف. يمنع
     * استعلامات LIKE القصيرة عديمة الجدوى وتفجّر مفاتيح الكاش (حارس DoS رخيص).
     */
    private function normalizeQ(Request $request): string
    {
        $filter = $request->query('filter');
        $q = is_array($filter) ? trim((string) ($filter['q'] ?? '')) : '';

        return mb_strlen($q) >= 2 ? mb_substr($q, 0, 100) : '';
    }
}
