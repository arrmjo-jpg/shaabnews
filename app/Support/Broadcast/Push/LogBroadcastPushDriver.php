<?php

declare(strict_types=1);

namespace App\Support\Broadcast\Push;

use App\Contracts\Broadcast\BroadcastPushDriver;
use Illuminate\Support\Facades\Log;

/**
 * الناقل الافتراضيّ (والوحيد المُنفَّذ حالياً): يسجّل نيّة النشر بدل تسليمه فعلياً.
 * Firebase Messaging غير مُهيّأ في هذه البيئة (المنصّة تستخدم Firebase Storage فقط)
 * — هذا مُقلِّد أمين: **لا يدّعي تسليماً وهمياً أبداً**، ولا يفشل أبداً (configured()
 * = true دائماً؛ ناقل السجلّ لا بيانات اعتماد خارجية يعتمد عليها لينكسر).
 *
 * كل سطر يبدأ بـ "[STUB]" صراحةً — لا وسيلة للخلط بينه وبين تسليم إنتاجيّ حقيقيّ
 * عند قراءة السجلّات.
 */
final class LogBroadcastPushDriver implements BroadcastPushDriver
{
    /** @param  array<string,mixed>  $payload */
    public function publish(string $topic, array $payload): void
    {
        Log::info('[STUB] broadcast.notification.publish — not delivered to any device', [
            'driver' => $this->name(),
            'topic' => $topic,
            'payload' => $payload,
        ]);
    }

    public function configured(): bool
    {
        return true;
    }

    public function name(): string
    {
        return 'log';
    }
}
