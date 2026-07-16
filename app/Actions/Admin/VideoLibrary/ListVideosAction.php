<?php

declare(strict_types=1);

namespace App\Actions\Admin\VideoLibrary;

use App\Http\Resources\Admin\VideoLibrary\VideoResource;
use App\Models\Video;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة فيديوهات الإدارة — ترشيح/فرز/ترقيم + رؤية المحذوف (trashed).
 */
class ListVideosAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $searchTerm = request()->input('filter.title');
        if (filled($searchTerm)) {
            try {
                $search = Video::search(trim((string) $searchTerm));

                // 1. تصفية الفلاتر الأساسية في Meilisearch لمطابقة سريعة
                if (request()->filled('filter.locale')) {
                    $search->where('locale', request()->input('filter.locale'));
                }
                if (request()->filled('filter.status')) {
                    $search->where('status', request()->input('filter.status'));
                }
                if (request()->filled('filter.visibility')) {
                    $search->where('visibility', request()->input('filter.visibility'));
                }
                if (request()->filled('filter.source_type')) {
                    $search->where('source_type', request()->input('filter.source_type'));
                }
                if (request()->filled('filter.author_id')) {
                    $search->where('author_id', (int) request()->input('filter.author_id'));
                }
                if (request()->filled('filter.video_category_id')) {
                    $search->where('video_category_id', (int) request()->input('filter.video_category_id'));
                }

                // التعامل مع المحذوفات في Scout
                $trashed = (string) request()->query('trashed', '');
                if ($trashed === 'only') {
                    $search->onlyTrashed();
                } elseif ($trashed === 'with') {
                    $search->withTrashed();
                }

                // 2. تحميل الأعمدة والعلاقات المطلوبة ومنع الـ N+1 Queries
                $search->query(fn ($query) => $query->select([
                    'id',
                    'uuid',
                    'status',
                    'visibility',
                    'source_type',
                    'is_featured',
                    'locale',
                    'translation_group',
                    'title',
                    'slug',
                    'views_count',
                    'sort_order',
                    'video_category_id',
                    'media_asset_id',
                    'author_id',
                    'published_at',
                    'created_at',
                    'deleted_at',
                ])->with(['author:id,name', 'mediaAsset', 'category:id,name,slug', 'engagementCounter']));

                $videos = $search->paginate($perPage)->appends(request()->query());

                return ApiResponse::success(
                    data: VideoResource::collection($videos)->resolve(),
                    meta: [
                        'pagination' => [
                            'total' => $videos->total(),
                            'count' => $videos->count(),
                            'per_page' => $videos->perPage(),
                            'current_page' => $videos->currentPage(),
                            'total_pages' => $videos->lastPage(),
                        ],
                    ]
                );
            } catch (\Throwable $e) {
                // تدهور رشيق: تسجيل الخطأ والرجوع للبحث في قاعدة البيانات
                report($e);
            }
        }

        $query = QueryBuilder::for(Video::class)
            ->select([
                'id',
                'uuid',
                'status',
                'visibility',
                'source_type',
                'is_featured',
                'locale',
                'translation_group',
                'title',
                'slug',
                'views_count',
                'sort_order',
                'video_category_id',
                'media_asset_id',
                'author_id',
                'published_at',
                'created_at',
                'deleted_at',
            ])
            ->with(['author:id,name', 'mediaAsset', 'category:id,name,slug', 'engagementCounter'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('visibility'),
                AllowedFilter::exact('locale'),
                AllowedFilter::exact('source_type'),
                AllowedFilter::exact('is_featured'),
                AllowedFilter::exact('video_category_id'),
                AllowedFilter::exact('author_id'),
                AllowedFilter::partial('title'),
            )
            ->allowedSorts('id', 'title', 'created_at', 'published_at', 'views_count', 'sort_order')
            ->defaultSort('-created_at');

        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $videos = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: VideoResource::collection($videos)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $videos->total(),
                    'count' => $videos->count(),
                    'per_page' => $videos->perPage(),
                    'current_page' => $videos->currentPage(),
                    'total_pages' => $videos->lastPage(),
                ],
            ]
        );
    }
}
