<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * ROOT CAUSE FIX (حزمة JS لقارئ الجريدة الرقمية تفشل بحظر CORS على new.harer.store، مؤكَّد حيًّا
 * 2026-08-10): صفحات القارئ (epaper.index/show/page) هي Blade/SSR في الباك-إند، لكن المستخدم
 * يزورها عبر دومين الواجهة العامة new.harer.store الذي يمرّرها (rewrite) لأصل الـAPI. بلا هذا
 * الـmiddleware، تُبنى كل الروابط المطلقة في هذه الصفحة — وسم @vite (حزم JS/CSS)، وroute()/url()
 * (روابط التنقّل، data-doc-endpoint وبقية نقاط الجلب) — بجذر APP_URL الثابت (دومين الباك-إند)،
 * فتصير طلبات <script>/<link>/fetch() عابرة للأصل ويحظرها المتصفّح.
 *
 * لماذا ترويسة مخصَّصة X-Epaper-Frontend-Origin لا X-Forwarded-Host: تحقَّقتُ مباشرة من إعدادات
 * Traefik الفعليّة (أوامر تشغيل الحاوية + ملفات dynamic/*.yaml، قراءة فقط) — forwardedHeaders في
 * وضعها الافتراضي (لا insecure=true، لا trustedIPs). هذا يعني Traefik **يعيد توليد**
 * X-Forwarded-Host بنفسه في كل قفزة يُنهيها بناءً على Host الفعليّ المُستخدَم للتوجيه — فحتى لو
 * حقنت الواجهة (frontend/src/middleware.ts) هذه الترويسة قبل استدعاء أصل الـAPI، ستستبدلها قفزة
 * Traefik الثانية (أمام الباك-إند) بـapi-new.harer.store (دومين تلك القفزة نفسها)، لا القيمة التي
 * رآها المتصفّح أصلاً. ترويسة عامّة (custom) لا يُديرها Traefik تمر دون تعديل عبر كلتا القفزتين —
 * فاستُخدمت بدلاً من ذلك.
 *
 * أمان الترويسة المخصَّصة: **لا تُستخدَم قيمتها كما هي أبداً**. تُقارَن حرفيًا (بعد rtrim) بقيمة
 * FRONTEND_URL المُعدَّة أصلاً في الباك-إند (config('frontend.public_url')، مؤكَّد وجودها في بيئة
 * الإنتاج). إن تطابقتا نُفرَض الجذر على *قيمة الإعداد الموثوقة نفسها* لا على قيمة الترويسة الواردة
 * — فحتى طلب مباشر للباك-إند بترويسة مزوَّرة لا يمكنه إطلاقاً حقن دومين اعتباطي (مثل evil.com) في
 * الروابط المولَّدة؛ أقصى أثر ممكن هو الحصول على نفس الجذر المعروف الآمن (FRONTEND_URL) الذي كان
 * سيظهر لأي زائر شرعي أصلاً — لا حقن، ولا اعتماد على TRUSTED_PROXIES لهذه الترويسة تحديداً.
 *
 * لا علاقة لهذا بتسليم/توقيع PDF إطلاقًا: EpaperDocumentDelivery::mint() يفرض جذره الخاص
 * (MediaUrl::origin()) بشكل صريح ومستقل تمامًا وقت التوقيع، وForceMediaRootUrl (مسار البثّ
 * الاحتياطي) يتحقّق بنفس ذلك الجذر — كلاهما في طلب/دورة حياة منفصلة تمامًا عن هذا الـmiddleware،
 * فلا تعارض ولا تأثير متبادل. كذلك لا علاقة له بـWorkers أو الـAPI الإداري أو Admin — لا يُطبَّق
 * إلا على 3 مسارات صفحة القارئ فقط (انظر routes/web.php).
 */
class ForceReaderPublicRootUrl
{
    public function handle(Request $request, Closure $next): Response
    {
        $trustedOrigin = rtrim((string) config('frontend.public_url'), '/');
        $claimedOrigin = rtrim((string) $request->header('X-Epaper-Frontend-Origin', ''), '/');

        if ($trustedOrigin !== '' && $claimedOrigin !== '' && hash_equals($trustedOrigin, $claimedOrigin)) {
            URL::forceRootUrl($trustedOrigin);
        }

        return $next($request);
    }
}
