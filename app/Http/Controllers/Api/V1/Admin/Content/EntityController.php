<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Content;

use App\Actions\Admin\Content\CreateEntityAction;
use App\Actions\Admin\Content\ListEntitiesAction;
use App\Actions\Admin\Content\SyncContentEntitiesAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Content\CreateEntityRequest;
use App\Http\Requests\Admin\Content\SyncContentEntitiesRequest;
use App\Http\Resources\Admin\Content\EntityResource;
use App\Models\Article;
use App\Models\Reel;
use App\Models\Video;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EntityController extends Controller
{
    /** بحث/اقتراح كيانات لواجهة التوسيم (entities.view). */
    public function index(Request $request): JsonResponse
    {
        return (new ListEntitiesAction)->handle(
            $request->query('type'),
            (string) $request->query('q', ''),
            (int) $request->query('limit', 20),
        );
    }

    /** إنشاء كيان جديد (entities.create). */
    public function store(CreateEntityRequest $request): JsonResponse
    {
        return (new CreateEntityAction)->handle($request->validated(), $request->user());
    }

    /** مزامنة كيانات مقال (articles.edit — جزء من تحرير المقال نفسه). */
    public function syncForArticle(SyncContentEntitiesRequest $request, Article $article): JsonResponse
    {
        return (new SyncContentEntitiesAction)->handle($article, $request->validated('entity_ids'), $request->user());
    }

    /** مزامنة كيانات فيديو (videos.edit). */
    public function syncForVideo(SyncContentEntitiesRequest $request, Video $video): JsonResponse
    {
        return (new SyncContentEntitiesAction)->handle($video, $request->validated('entity_ids'), $request->user());
    }

    /** مزامنة كيانات ريل (reels.edit). */
    public function syncForReel(SyncContentEntitiesRequest $request, Reel $reel): JsonResponse
    {
        return (new SyncContentEntitiesAction)->handle($reel, $request->validated('entity_ids'), $request->user());
    }

    /** الكيانات الموسومة حالياً على مقال (articles.edit — قراءة الحالة قبل التحرير). */
    public function forArticle(Article $article): JsonResponse
    {
        return ApiResponse::success(data: EntityResource::collection($article->entities()->get()));
    }

    /** الكيانات الموسومة حالياً على فيديو (videos.edit). */
    public function forVideo(Video $video): JsonResponse
    {
        return ApiResponse::success(data: EntityResource::collection($video->entities()->get()));
    }

    /** الكيانات الموسومة حالياً على ريل (reels.edit). */
    public function forReel(Reel $reel): JsonResponse
    {
        return ApiResponse::success(data: EntityResource::collection($reel->entities()->get()));
    }
}
