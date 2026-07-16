<?php

declare(strict_types=1);

namespace App\Support\Content\Workflow;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * تنفيذ الانتقال (تعيين الحالة + الطوابع الزمنيّة + الحفظ) — الجزء
 * المتطابق حرفياً بين Article/Video/Reel اليوم (Task 6a).
 *
 * تسجيل المراجعات يبقى خارج هذا المساعد عمداً: Video لا يملكه اليوم
 * (فجوة موثّقة منفصلة، لا نقرّرها ضمنياً هنا)، فالمُستدعي يمرّر callback
 * اختياريًّا يُنفَّذ **داخل نفس المعاملة** — إن فشل، يتراجع كلّ شيء معًا
 * تمامًا كما كان قبل هذا الاستخراج.
 */
final class ApplyEditorialTransition
{
    /**
     * @param  (callable(Model, User): void)|null  $afterSave
     */
    public static function run(
        Model $content,
        string $targetValue,
        User $actor,
        ?Carbon $scheduledAt,
        ?callable $afterSave = null,
    ): Model {
        return DB::transaction(function () use ($content, $targetValue, $actor, $scheduledAt, $afterSave): Model {
            $content->status = $targetValue;

            if ($targetValue === 'published') {
                $content->published_at = $content->published_at ?? now();
                $content->published_by_id = $actor->id;
            } elseif ($targetValue === 'scheduled') {
                $content->published_at = $scheduledAt;
            }

            $content->save();

            if ($afterSave !== null) {
                $afterSave($content, $actor);
            }

            return $content;
        });
    }
}
