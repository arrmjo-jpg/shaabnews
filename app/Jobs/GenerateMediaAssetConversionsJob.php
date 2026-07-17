<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\MediaAsset;
use App\Support\Media\MediaConversions;
use App\Support\Media\RemoteStorage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * يولّد مشتقّات WebP (thumb/medium + watermarked الاختياري) لأصل مكتبة
 * مركزي (queue=media). No-op آمن لغير الصور؛ لا يكسر مسار الرفع.
 *
 * يدير دورة الحالة: processing → ready | failed (عمود processing_status).
 * يكتب عبر Eloquent (Rule 2)؛ الحقل غير مُدقَّق فلا ضجيج تدقيق.
 */
class GenerateMediaAssetConversionsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;

    public int $timeout = 120;

    public function __construct(private readonly int $mediaAssetId)
    {
        // توجيه صريح عبر الخصائص: طابور media + اتصال الوسائط الطويل (retry_after
        // فيه يتجاوز timeout=120 فلا إعادة إتاحة مزدوجة). null في الاختبارات ⇒ sync.
        $this->onQueue('media');
        $this->onConnection(config('queue.media_connection'));
    }

    public function handle(): void
    {
        $asset = MediaAsset::query()->find($this->mediaAssetId);
        if ($asset === null || ! $asset->isConvertibleImage()) {
            return;
        }

        $asset->forceFill(['processing_status' => 'processing'])->save();

        try {
            MediaConversions::generate($asset);
            $ready = ! empty($asset->fresh()?->conversions);
            $asset->forceFill(['processing_status' => $ready ? 'ready' : 'failed'])->save();

            // التخزين الهجين: انسخ الأصل + مشتقّاته إلى المرآة البعيدة (إن فُعّلت).
            if ($ready && RemoteStorage::enabled()) {
                MirrorMediaToRemoteJob::dispatch($asset->id);
            }
        } catch (Throwable $e) {
            $asset->forceFill(['processing_status' => 'failed'])->save();
            throw $e;
        }
    }

    public function failed(?Throwable $e): void
    {
        $asset = MediaAsset::query()->find($this->mediaAssetId);
        $asset?->forceFill(['processing_status' => 'failed'])->save();
    }
}
