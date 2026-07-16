<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Http\Resources\Public\Content\PublicLiveUpdateResource;
use App\Models\Article;
use App\Models\ArticleLiveUpdate;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * تسليم تحديثات التغطية الحيّة (قراءة عامة) — مفصول عن بيانات المقال الوصفية.
 *
 * مبدأ معماري (P8.3): بيانات المقال الوصفية تُسلَّم عبر نقطة المقال العامة
 * (كاش tag=articles)؛ هذا المسار يسلّم الخط الزمني فقط (كاش tag=live_updates)
 * بترقيم صفحات وترتيب «المثبّت أولاً ثم زمنياً».
 *
 * توفير عرض النطاق للاستطلاع (polling):
 *  - بصمة خفيفة (عدد + أحدث updated_at) تُحسَب لكل طلب.
 *  - ETag مبنيّ على البصمة → 304 عند عدم التغيّر (لا جسم استجابة).
 *  - مفتاح الكاش يتضمّن البصمة → إبطال تلقائي عند أي تعديل/تثبيت/حذف.
 */
class ListPublicLiveUpdatesAction
{
    private const MAX_PER_PAGE = 50;

    public function handle(string $locale, string $slug, Request $request): HttpResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            return ApiResponse::error(__('article.invalid_locale'), [], 422);
        }

        $article = Article::query()
            ->published()
            ->forLocale($locale)
            ->where(function ($query) use ($slug) {
                if (is_numeric($slug)) {
                    $query->where('id', (int) $slug);
                } elseif (preg_match('/^(\d+)-(.*)$/', $slug, $matches)) {
                    $query->where('id', (int) $matches[1]);
                } else {
                    $query->where('slug', $slug);
                }
            })
            ->first(['id', 'slug', 'locale', 'type']);

        if ($article === null) {
            return ApiResponse::error(__('article.not_found'), [], 404);
        }

        $default = (int) config('performance.pagination.default');
        $perPage = max(1, min(self::MAX_PER_PAGE, (int) $request->integer('per_page', $default)));
        $page = max(1, (int) $request->integer('page', 1));

        // بصمة خفيفة لكامل الخط الزمني (تلتقط الإضافة/التعديل/التثبيت/الحذف)
        $stats = ArticleLiveUpdate::query()
            ->where('article_id', $article->id)
            ->selectRaw('COUNT(*) as c, MAX(updated_at) as m')
            ->first();

        $count = (int) ($stats->c ?? 0);
        $lastModifiedRaw = $stats->m ?? null;
        $fingerprint = substr(hash('xxh128', $count.'|'.((string) $lastModifiedRaw)), 0, 16);

        $etag = '"'.md5("{$article->id}:{$page}:{$perPage}:{$fingerprint}").'"';

        // نافذة تحقّق قصيرة على الحافة لمسار حيّ (أقصر من افتراضي public.cache)
        $liveCacheControl = 'public, max-age=5, s-maxage=15, stale-while-revalidate=30';

        // 304 إن طابق العميل ETag الحالي — لا جسم استجابة (توفير نطاق)
        if (trim((string) $request->headers->get('If-None-Match'), 'W/') === $etag) {
            return response('', HttpResponse::HTTP_NOT_MODIFIED)
                ->setEtag($etag, false)
                ->header('Cache-Control', $liveCacheControl)
                ->header('Vary', 'Accept-Language')
                ->header('X-Live-Count', (string) $count);
        }

        $payload = Cache::tags(['live_updates'])->remember(
            CacheKeys::publicLiveUpdates($locale, $slug, $page, $perPage, $fingerprint),
            CacheTtl::SHORT,
            function () use ($article, $perPage): array {
                $paginator = $article->liveUpdates()
                    ->timelineOrder()
                    ->with(['author:id,name', 'mediaAssets'])
                    ->paginate($perPage)
                    ->appends(request()->query());

                return [
                    'data' => PublicLiveUpdateResource::collection($paginator)->resolve(),
                    'pagination' => [
                        'total' => $paginator->total(),
                        'count' => $paginator->count(),
                        'per_page' => $paginator->perPage(),
                        'current_page' => $paginator->currentPage(),
                        'total_pages' => $paginator->lastPage(),
                    ],
                ];
            }
        );

        $response = ApiResponse::success(
            data: $payload['data'],
            meta: ['pagination' => $payload['pagination']],
        );

        $response->setEtag($etag, false);
        $response->headers->set('Cache-Control', $liveCacheControl);
        $response->headers->set('Vary', 'Accept-Language');
        $response->headers->set('X-Live-Count', (string) $count);
        if ($lastModifiedRaw !== null) {
            $response->headers->set(
                'Last-Modified',
                Carbon::parse($lastModifiedRaw)->toRfc7231String(),
            );
        }

        return $response;
    }
}
