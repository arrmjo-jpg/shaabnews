<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Media\MediaUrl;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * ROOT CAUSE FIX (بثّ PDF الاحتياطي للجريدة الرقمية يفشل دائماً بـ403 "Invalid signature"،
 * مؤكَّد حيّاً 2026-08-10، على كلا مسارَي الوصول: مباشرةً على backend، وعبر rewrite الواجهة):
 *
 * EpaperDocumentDelivery::mint() يوقّع رابط epaper.document.stream بعد فرض الجذر صراحةً على
 * URL::forceRootUrl(MediaUrl::origin()) — حتى يبقى الرابط صالحاً لمتصفّح المستخدم دائماً (دومين
 * الواجهة العامّ)، بصرف النظر عن القناة الداخليّة التي استلمت طلب التوقيع.
 *
 * محاولة أولى فاشلة (تُركت هنا للتوثيق، صُحِّحت لاحقاً بهذا الملف): افتراض أن استدعاء
 * URL::forceRootUrl() مجدداً داخل middleware يعمل *قبل* 'signed' المدمَج كافٍ ليتحقّق التوقيع
 * بنفس الجذر. **خاطئ** — تحقّقتُ من مصدر Laravel مباشرة
 * (Illuminate\Routing\UrlGenerator::hasCorrectSignature()، Laravel v13): يبني الرابط للمقارنة عبر
 * `$request->url()`، وهي طريقة على كائن Request نفسه (Illuminate\Http\Request::url() →
 * Symfony getUri()) — مشتقّة من مضيف/مخطّط الطلب الوارد *فعليّاً*، **لا علاقة لها إطلاقاً**
 * بحالة UrlGenerator أو forceRootUrl. النتيجة: توقيع بجذر (MediaUrl::origin())، تحقّق بجذر مختلف
 * تماماً (مضيف الطلب الفعليّ لدى backend — api-new.harer.store مثلاً، حتى عبر rewrite الواجهة،
 * إذ لا شيء يُعيد كتابة Host إلى الدومين العامّ في تلك القناة) ⇒ فشل توقيع دائم على أي دومين.
 *
 * الإصلاح الصحيح: استبدال middleware الـ'signed' المدمَج بالكامل لهذا المسار تحديداً، بإعادة تنفيذ
 * نفس خوارزمية Laravel *حرفيّاً* (نُسخت من UrlGenerator::hasCorrectSignature()/
 * signatureHasNotExpired() — نفس معالجة query string، نفس محلّل المفتاح config('app.key') +
 * app.previous_keys، نفس hash_hmac sha256) لكن مبنيّة على MediaUrl::origin() بدل
 * $request->url() — الجذر الوحيد الصحيح لمطابقة ما استُخدم فعليّاً وقت التوقيع.
 */
class ForceMediaRootUrl
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->hasValidSignature($request)) {
            throw new InvalidSignatureException;
        }

        return $next($request);
    }

    private function hasValidSignature(Request $request): bool
    {
        $signature = $request->query('signature');
        if (! is_string($signature)) {
            return false;
        }

        $url = rtrim(MediaUrl::origin(), '/').$request->getPathInfo();

        $queryString = (new Collection(explode('&', (string) $request->server->get('QUERY_STRING'))))
            ->reject(fn (string $parameter): bool => Str::before($parameter, '=') === 'signature')
            ->join('&');

        $original = rtrim($url.'?'.$queryString, '?');

        $keys = array_filter([config('app.key'), ...(config('app.previous_keys') ?? [])]);
        $validSignature = false;
        foreach ($keys as $key) {
            if (hash_equals(hash_hmac('sha256', $original, (string) $key), $signature)) {
                $validSignature = true;
                break;
            }
        }
        if (! $validSignature) {
            return false;
        }

        $expires = $request->query('expires');
        if ($expires !== null && ! is_string($expires)) {
            return false;
        }

        return ! ($expires && now()->getTimestamp() > (int) $expires);
    }
}
