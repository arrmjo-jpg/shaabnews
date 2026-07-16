<?php

declare(strict_types=1);

namespace App\Contracts\Broadcast;

/**
 * عقد ناقل دفع البثّ القابل للتبديل — نفس شكل App\Contracts\Ai\AiProvider تماماً:
 * نقطة تبديل واحدة يُقرَّر عندها المزوّد الفعليّ بالإعداد فقط (broadcast.notifications.push_driver)
 * لا بكود جديد. BroadcastPushGateway يعتمد على هذا العقد فقط ولا يعرف الناقل الفعليّ.
 */
interface BroadcastPushDriver
{
    /**
     * ينشر رسالة لموضوع تسليم (FCM topic أو معادله).
     *
     * @param  array<string,mixed>  $payload
     *
     * @throws \RuntimeException عند فشل التسليم الفعليّ (ناقل حقيقيّ فقط — المُقلِّد لا يفشل أبداً)
     */
    public function publish(string $topic, array $payload): void;

    /** هل الناقل مُهيّأ فعليّاً (بيانات اعتماد حقيقية موجودة)؟ المُقلِّد دائماً true. */
    public function configured(): bool;

    /** المعرّف القصير للناقل (log|fcm|…) — للتشخيص وفحوصات الصحّة. */
    public function name(): string;
}
