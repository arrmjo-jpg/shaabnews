<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Support\Media\RemoteStorage;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * رؤية تشغيليّة لحظيّة للجريدة: تراكم طوابير الجريدة (media/analytics)، ومؤشّر
 * التسليم البعيد. أفضل-جهد: لا يسقط على تعذّر جدول الطوابير.
 */
class EpaperOperationsAction
{
    public function handle(): JsonResponse
    {
        return ApiResponse::success(__('epaper.operations.shown'), [
            'queues' => $this->queues(),
            'delivery' => ['remote_enabled' => RemoteStorage::enabled()],
            'checked_at' => now()->toISOString(),
        ]);
    }

    /**
     * عدّ تراكم الطوابير — أفضل-جهد من جدول jobs (دقيق حين QUEUE=database؛ مع redis
     * يكون صفراً، كما في System Diagnostics العامّة). لا يسقط على تعذّر الجدول.
     *
     * @return array<string,int>
     */
    private function queues(): array
    {
        try {
            $byQueue = DB::table('jobs')->selectRaw('queue, COUNT(*) c')->groupBy('queue')->pluck('c', 'queue');

            return [
                'pending' => (int) DB::table('jobs')->count(),
                'failed' => (int) DB::table('failed_jobs')->count(),
                'media' => (int) ($byQueue['media'] ?? 0),
                'analytics' => (int) ($byQueue['analytics'] ?? 0),
            ];
        } catch (Throwable) {
            return ['pending' => 0, 'failed' => 0, 'media' => 0, 'analytics' => 0];
        }
    }
}
