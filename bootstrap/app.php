<?php

use App\Http\Middleware\EnsureNewspaperEnabled;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureWriter;
use App\Http\Middleware\ForceMediaRootUrl;
use App\Http\Middleware\ForceReaderPublicRootUrl;
use App\Http\Middleware\PublicCacheHeaders;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\VerifyRecaptcha;
use App\Support\Responses\ApiExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // /broadcasting/auth بمصادقة Sanctum (Bearer) لا web/session: الإدارة Bearer-only،
    // فلو بقي على web guard لرجعت القنوات الخاصة 403 رغم نجاح REST.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['api', 'auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // ترويسات أمان دفاعية على كل استجابات الـ API
        $middleware->api(append: [
            SecurityHeaders::class,
        ]);

        // هذا تطبيق API بحت (Sanctum Bearer فقط) — لا صفحة تسجيل دخول ويب مُسجَّلة إطلاقًا.
        // افتراضي Authenticate::redirectTo() في Laravel يستدعي route('login') لأي طلب لا يحمل
        // Accept: application/json (عملاء لا يضبطون هذا الرأس صراحة، مثل curl الخام) — بما أن
        // هذا الراوت غير موجود هنا، كان ذلك يرمي RouteNotFoundException غير مُعالَج في
        // ApiExceptionRenderer، فيتحوّل زورًا إلى 500 بدل 401 Unauthenticated الصحيح. تعطيل
        // إعادة التوجيه نهائيًا (بدل الاعتماد على رأس الطلب) يضمن أن AuthenticationException
        // الحقيقي يصل دائمًا لـ ApiExceptionRenderer الذي يعالجه بالفعل بشكل صحيح (401 JSON).
        $middleware->redirectGuestsTo(fn () => null);

        // TrustProxies (V1) — خلف CDN يجب أن يحلّ $request->ip() عنوان العميل الحقيقي ليصحّ
        // ربط حمايات الإعلان/التفاعل بالـ IP. مدفوع بيئياً: TRUSTED_PROXIES = قائمة CIDR
        // مفصولة بفواصل، أو '*' (آمن فقط إن كان الأصل مقفولاً شبكياً على الـ CDN). فارغ ⇒
        // لا ثقة بأيّ وكيل (الحالة الافتراضية الآمنة — سلوك اليوم؛ لا يُعتدّ بـ X-Forwarded-For).
        $trustedProxies = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('TRUSTED_PROXIES', '')),
        )));
        if ($trustedProxies !== []) {
            $middleware->trustProxies(
                at: in_array('*', $trustedProxies, true) ? '*' : $trustedProxies,
                headers: Request::HEADER_X_FORWARDED_FOR
                    | Request::HEADER_X_FORWARDED_HOST
                    | Request::HEADER_X_FORWARDED_PORT
                    | Request::HEADER_X_FORWARDED_PROTO,
            );
        }

        $middleware->alias([
            // مصادقة الحساب
            'active' => EnsureUserIsActive::class,

            // بوّابة الكاتب (is_writer=true) — إرسال المحتوى العام
            'writer' => EnsureWriter::class,

            // بوابة وحدة الجريدة الرقمية (معطَّل = 404)
            'newspaper.enabled' => EnsureNewspaperEnabled::class,

            // يستبدل middleware الـ'signed' المدمَج بالكامل لمسار بثّ PDF الاحتياطي — يتحقّق من
            // التوقيع بنفس جذر URL المستخدَم وقت التوقيع (EpaperDocumentDelivery::mint) لا بمضيف
            // الطلب الوارد فعليّاً. انظر App\Http\Middleware\ForceMediaRootUrl للتفصيل الكامل.
            'media.root-url' => ForceMediaRootUrl::class,

            // صفحات قارئ الجريدة الرقمية (Blade/SSR) فقط — يفرض جذر الروابط المطلقة (@vite،
            // route()) على مضيف الطلب الوارد الموثوق بدل APP_URL الثابت. انظر
            // App\Http\Middleware\ForceReaderPublicRootUrl للتفصيل الكامل.
            'epaper.reader-root' => ForceReaderPublicRootUrl::class,

            // حماية reCAPTCHA (gated بـ recaptcha_enabled)
            'recaptcha' => VerifyRecaptcha::class,

            // كاش CDN/المتصفّح للمسارات العامة (P7)
            'public.cache' => PublicCacheHeaders::class,

            // Sanctum token abilities
            'abilities' => CheckAbilities::class,
            'ability' => CheckForAnyAbility::class,

            // Spatie Permission
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // كل طلبات الـ API ترجع بعقد الاستجابة الموحّد
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return ApiExceptionRenderer::render($e);
            }

            return null;
        });
    })->create();
