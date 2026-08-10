<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Media\MediaUrl;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * ROOT CAUSE FIX (بثّ PDF الاحتياطي للجريدة الرقمية يفشل دائماً بـ403 "Invalid signature"،
 * مؤكَّد حيّاً 2026-08-10): EpaperDocumentDelivery::mint() يوقّع رابط epaper.document.stream
 * بعد فرض الجذر صراحةً على URL::forceRootUrl(MediaUrl::origin()) — حتى يصل الرابط دائماً لنفس
 * الأصل العامّ (دومين الواجهة) بصرف النظر عن أي قناة داخليّة استلمت طلب التوقيع. لكن middleware
 * الـ'signed' المدمج في Laravel (ValidateSignature) يتحقّق من التوقيع باستخدام جذر URL الحاليّ
 * (المشتقّ من الطلب الوارد فعليّاً وقت التحقّق، لا وقت التوقيع) — لا علاقة له بـforceRootUrl التي
 * طُبِّقت في طلب سابق منفصل تمامًا (كل طلب HTTP يبدأ بحالة URL نظيفة). النتيجة: توقيع بجذر، تحقّق
 * بجذر آخر ⇒ فشل دائم، بصرف النظر عن أي دومين فعليّ (مؤكَّد: يفشل حتى عند الطلب المباشر لباك إند
 * نفسه، لا مجرّد مشكلة rewrite في Next.js).
 *
 * الإصلاح: فرض نفس الجذر بالضبط (MediaUrl::origin()) قبل تشغيل middleware الـ'signed' — يُسجَّل
 * قبله في مصفوفة middleware الخاصة بـ epaper.document.stream (routes/web.php) تحديدًا.
 */
class ForceMediaRootUrl
{
    public function handle(Request $request, Closure $next): Response
    {
        URL::forceRootUrl(MediaUrl::origin());

        return $next($request);
    }
}
