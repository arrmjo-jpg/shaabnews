<?php

declare(strict_types=1);

namespace App\Actions\Admin\VideoLibrary;

use App\Http\Resources\Admin\VideoLibrary\VideoPlaylistResource;
use App\Models\VideoPlaylist;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ListVideoPlaylistsAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $query = QueryBuilder::for(VideoPlaylist::class)
            ->select([
                'id',
                'status',
                'visibility',
                'locale',
                'title',
                'slug',
                'is_featured',
                'published_at',
                'created_at',
                'deleted_at',
                'author_id',
                'cover_media_id',
                'sort_order',
            ])
            ->with(['author:id,name', 'cover'])
            ->withCount('videos')
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('visibility'),
                AllowedFilter::exact('locale'),
                AllowedFilter::exact('is_featured'),
                AllowedFilter::partial('title'),
            )
            ->allowedSorts('id', 'title', 'created_at', 'published_at', 'sort_order')
            ->defaultSort('-created_at');

        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $playlists = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: VideoPlaylistResource::collection($playlists)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $playlists->total(),
                    'count' => $playlists->count(),
                    'per_page' => $playlists->perPage(),
                    'current_page' => $playlists->currentPage(),
                    'total_pages' => $playlists->lastPage(),
                ],
            ]
        );
    }
}
