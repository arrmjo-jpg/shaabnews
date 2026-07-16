<?php

declare(strict_types=1);

namespace App\Support\Broadcast;

use App\Contracts\Broadcast\BroadcastPushDriver;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * بوّابة دفع البثّ — حدّ التسليم الخارجي (FCM topics). نموذج المواضيع: نشر رسالة
 * واحدة لموضوع يتولّى المزوّد توزيعها على آلاف الأجهزة المشتركة — لا حلقة على
 * المستخدمين هنا إطلاقاً (يتحمّل 100k+ بنشرٍ واحد لكل موضوع).
 *
 * لا تنفّذ التسليم بنفسها — تحلّ BroadcastPushDriver من الحاوية (مُهيَّأ حسب
 * broadcast.notifications.push_driver) وتُفوِّض إليه. تفعيل Firebase الحقيقيّ لاحقاً
 * = كتابة ناقل FCM يطبّق العقد + ضبط الإعداد على "fcm" — **لا تعديل هنا ولا في أيّ
 * مستدعٍ** (راجع docs/architecture/BROADCAST-PUSH.md).
 *
 * حارس صريح: إن كانت الإشعارات مفعَّلة (enabled=true) لكن الناقل المُهيَّأ غير
 * جاهز فعلياً (configured()=false) — يفشل بصوتٍ عالٍ (استثناء) بدل الصمت. هذا
 * المسار خامل اليوم عمداً: ناقل السجلّ الوحيد المتاح configured()=true دائماً؛
 * يصبح فعّالاً فقط حين يُختار ناقل حقيقيّ غير مُهيَّأ بالخطأ.
 */
class BroadcastPushGateway
{
    public function __construct(private readonly BroadcastPushDriver $driver) {}

    /** @param  array<string,mixed>  $payload */
    public function publish(string $topic, array $payload): void
    {
        if (! (bool) config('broadcast.notifications.enabled', true)) {
            return;
        }

        if (! $this->driver->configured()) {
            $message = "Broadcast push is enabled but the '{$this->driver->name()}' driver is not configured — no notification was sent.";
            Log::error('broadcast.notification.misconfigured', [
                'driver' => $this->driver->name(),
                'topic' => $topic,
            ]);

            throw new RuntimeException($message);
        }

        $this->driver->publish($topic, $payload);
    }
}
