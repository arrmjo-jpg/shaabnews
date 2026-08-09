<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Epaper;

use App\Actions\Admin\Epaper\CreateEpaperAction;
use App\Actions\Admin\Epaper\DeleteEpaperAction;
use App\Actions\Admin\Epaper\DuplicateEpaperAction;
use App\Actions\Admin\Epaper\EpaperDashboardAnalyticsAction;
use App\Actions\Admin\Epaper\EpaperOperationsAction;
use App\Actions\Admin\Epaper\ForceDeleteEpaperAction;
use App\Actions\Admin\Epaper\ListEpapersAction;
use App\Actions\Admin\Epaper\ReplacePdfAction;
use App\Actions\Admin\Epaper\RestoreEpaperAction;
use App\Actions\Admin\Epaper\SetEpaperCoverAction;
use App\Actions\Admin\Epaper\ShowEpaperAnalyticsAction;
use App\Actions\Admin\Epaper\TransitionEpaperStatusAction;
use App\Actions\Admin\Epaper\UpdateEpaperAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Epaper\EpaperDashboardAnalyticsRequest;
use App\Http\Requests\Admin\Epaper\ReplacePdfRequest;
use App\Http\Requests\Admin\Epaper\SetEpaperCoverRequest;
use App\Http\Requests\Admin\Epaper\StoreEpaperRequest;
use App\Http\Requests\Admin\Epaper\TransitionEpaperRequest;
use App\Http\Requests\Admin\Epaper\UpdateEpaperRequest;
use App\Http\Resources\Admin\Epaper\EpaperResource;
use App\Models\Epaper;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

class EpaperController extends Controller
{
    public function index(): JsonResponse
    {
        return (new ListEpapersAction)->handle();
    }

    public function show(Epaper $epaper): JsonResponse
    {
        return ApiResponse::success(
            __('epaper.shown'),
            new EpaperResource($epaper->load(['mediaAsset', 'author', 'versions.mediaAsset'])),
        );
    }

    public function store(StoreEpaperRequest $request): JsonResponse
    {
        return (new CreateEpaperAction)->handle($request->validated(), $request->file('file'), $request->user());
    }

    public function update(UpdateEpaperRequest $request, Epaper $epaper): JsonResponse
    {
        return (new UpdateEpaperAction)->handle($epaper, $request->validated());
    }

    public function replacePdf(ReplacePdfRequest $request, Epaper $epaper): JsonResponse
    {
        return (new ReplacePdfAction)->handle($epaper, $request->file('file'), $request->input('note'), $request->user());
    }

    /** رفع/تعيين غلاف العدد يدوياً (صورة) — يُخزَّن في conversions['cover']. */
    public function setCover(SetEpaperCoverRequest $request, Epaper $epaper): JsonResponse
    {
        return (new SetEpaperCoverAction)->handle($epaper, $request->file('cover'));
    }

    /** تقرير تحليلات القارئ لهذا العدد (أساسيّ — Phase 5). */
    public function analytics(Epaper $epaper): JsonResponse
    {
        return (new ShowEpaperAnalyticsAction)->handle($epaper);
    }

    /** لوحة تحليلات القارئ العابرة للأعداد (Final completion) — نظرة عامّة + ترتيب + سلوك. */
    public function dashboard(EpaperDashboardAnalyticsRequest $request): JsonResponse
    {
        return (new EpaperDashboardAnalyticsAction)->handle(
            (string) ($request->validated('period') ?: '30d'),
            $request->validated('from'),
            $request->validated('to'),
        );
    }

    /** رؤية تشغيليّة للجريدة (Final completion — البند C): طوابير + تسليم بعيد. */
    public function operations(): JsonResponse
    {
        return (new EpaperOperationsAction)->handle();
    }

    public function status(TransitionEpaperRequest $request, Epaper $epaper): JsonResponse
    {
        return (new TransitionEpaperStatusAction)->handle($epaper, $request->validated(), $request->user());
    }

    public function duplicate(Epaper $epaper): JsonResponse
    {
        return (new DuplicateEpaperAction)->handle($epaper, request()->user());
    }

    public function destroy(Epaper $epaper): JsonResponse
    {
        return (new DeleteEpaperAction)->handle($epaper);
    }

    public function restore(Epaper $epaper): JsonResponse
    {
        return (new RestoreEpaperAction)->handle($epaper);
    }

    public function forceDelete(Epaper $epaper): JsonResponse
    {
        return (new ForceDeleteEpaperAction)->handle($epaper);
    }
}
