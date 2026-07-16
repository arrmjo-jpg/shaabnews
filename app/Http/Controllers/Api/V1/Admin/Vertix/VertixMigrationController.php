<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin\Vertix;

use App\Actions\Admin\Vertix\ImportVertixCategoriesAction;
use App\Actions\Admin\Vertix\ImportVertixNewsBatchAction;
use App\Enums\VertixPhase;
use App\Enums\VertixRunStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Vertix\ImportVertixNewsChunkJob;
use App\Models\Category;
use App\Models\VertixRun;
use App\Support\Responses\ApiResponse;
use App\Support\Vertix\VertixConnection;
use App\Support\Vertix\VertixSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * لوحة Vertix Migration — نظام مستقلّ، يحفظ المعرّفات الأصليّة (لا mapping).
 * مرحلتان: استيراد الأقسام (متزامن) ثمّ استيراد الأخبار (مهمّة طابور تزايديّة).
 */
class VertixMigrationController extends Controller
{
    public function status(): JsonResponse
    {
        return ApiResponse::success(__('vertix.status_ok'), $this->snapshot());
    }

    /** المرحلة الأولى: استيراد الأقسام بمعرّفها الأصليّ (متزامن، Idempotent). */
    public function importCategories(): JsonResponse
    {
        if (! VertixConnection::canConnect()) {
            return ApiResponse::error(__('vertix.connection_failed'), [], 422);
        }

        (new ImportVertixCategoriesAction)->handle();

        return ApiResponse::success(__('vertix.categories_imported'), $this->snapshot());
    }

    /** المرحلة الثانية: بدء استيراد الأخبار (يتطلّب وجود أقسام مُستورَدة). */
    public function importNews(): JsonResponse
    {
        if (! VertixConnection::canConnect()) {
            return ApiResponse::error(__('vertix.connection_failed'), [], 422);
        }

        if (! Category::query()->exists()) {
            return ApiResponse::error(__('vertix.categories_required'), [], 422);
        }

        $run = VertixRun::forPhase(VertixPhase::News);
        if ($run->status === VertixRunStatus::Running) {
            return ApiResponse::error(__('vertix.already_running'), [], 422);
        }

        ImportVertixNewsBatchAction::initialize($run); // سقف الردم = أعلى newsid (الأحدث أولاً)
        $run->forceFill([
            'status' => VertixRunStatus::Running->value,
            'total' => VertixSource::make()->newsCount(),
            'started_at' => $run->started_at ?? now(),
            'finished_at' => null,
            'last_error' => null,
        ])->save();

        ImportVertixNewsChunkJob::dispatch();

        return ApiResponse::success(__('vertix.news_started'), $this->snapshot());
    }

    /** إيقاف استيراد الأخبار (المهمة تكفّ عند الدورة التالية). */
    public function stopNews(): JsonResponse
    {
        $run = VertixRun::forPhase(VertixPhase::News);
        if ($run->status === VertixRunStatus::Running) {
            $run->forceFill(['status' => VertixRunStatus::Idle->value])->save();
        }

        return ApiResponse::success(__('vertix.news_stopped'), $this->snapshot());
    }

    /** @return array<string,mixed> */
    private function snapshot(): array
    {
        $connected = VertixConnection::canConnect();
        $catRun = VertixRun::forPhase(VertixPhase::Categories);
        $newsRun = VertixRun::forPhase(VertixPhase::News);

        $catSourceTotal = $connected
            ? (int) Cache::remember('vertix:cat_total', 60, fn (): int => VertixSource::make()->categoriesCount())
            : 0;
        $newsSourceTotal = $connected
            ? (int) Cache::remember('vertix:news_total', 60, fn (): int => VertixSource::make()->newsCount())
            : 0;

        // العدّ من الجدول الهدف مباشرةً (المعرّف = newsid/catid ⇒ الجدول هو سجلّ المُستورَد).
        $catImported = (int) Category::query()->count();
        $newsImported = $newsRun->imported;

        $errors = array_slice(array_merge($catRun->errors ?? [], $newsRun->errors ?? []), -20);

        return [
            'connected' => $connected,
            'categories' => [
                'status' => $catRun->status->value,
                'source_total' => $catSourceTotal,
                'imported' => $catImported,
                'remaining' => max(0, $catSourceTotal - $catImported),
                'failed' => $catRun->failed,
            ],
            'news' => [
                'status' => $newsRun->status->value,
                'source_total' => $newsSourceTotal,
                // الردم مكتمل ⇒ كلّ خبر مؤهَّل إمّا مُستورَد أو فاشل، فالمُستورَد = الإجمالي − الفاشل
                // (لا عدّاد التشغيل الذي يُسقِط المتخطَّى/المُستورَد في تشغيلٍ سابق فيُظهر «متبقٍّ» وهميّاً).
                'imported' => $newsRun->backfill_done ? max(0, $newsSourceTotal - $newsRun->failed) : $newsImported,
                'remaining' => $newsRun->backfill_done ? 0 : max(0, $newsSourceTotal - $newsImported),
                'failed' => $newsRun->failed,
            ],
            'errors' => array_values($errors),
        ];
    }
}
