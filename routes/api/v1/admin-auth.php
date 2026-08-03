<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\Auth\AdminAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin Auth Guest Routes — /api/v1/admin/auth/*
|--------------------------------------------------------------------------
| هذه المسارات لا تتطلب مصادقة مسبقة.
| تسجيل الدخول وإعادة تعيين كلمة المرور فقط.
|
| تسجيل الدخول للإداريين يحظر النفاذ إلى المستخدمين العاديين
| على مستوى الـ Action — قبل إصدار أي token.
*/

Route::post('/login', [AdminAuthController::class, 'login'])
    ->middleware(['throttle:admin.login', 'recaptcha:admin_login']);

// تسجيل دخول تطبيق الموبايل — نفس المنطق تمامًا، بلا reCAPTCHA (v3 مصمَّم لصفحة ويب، لا يعمل من
// عميل native؛ الحماية التعويضية هي نفس throttle:admin.login الصارم: 5 محاولات/دقيقة لكل IP).
// راجع docs/mobile/architecture/adr/ADR-012-mobile-login-recaptcha-exemption.md.
Route::post('/mobile-login', [AdminAuthController::class, 'login'])
    ->middleware(['throttle:admin.login']);

Route::post('/forgot-password', [AdminAuthController::class, 'forgotPassword'])
    ->middleware(['throttle:admin.forgot-password', 'recaptcha:admin_forgot_password']);

Route::post('/reset-password', [AdminAuthController::class, 'resetPassword'])
    ->middleware(['throttle:admin.forgot-password', 'recaptcha:admin_reset_password']);

// ─── تحقّق البريد ───────────────────────────────────────────────────────
Route::post('/email/resend', [AdminAuthController::class, 'resendEmailVerification'])
    ->middleware('throttle:admin.forgot-password');

Route::get('/email/verify/{id}/{hash}', [AdminAuthController::class, 'verifyEmail'])
    ->middleware(['signed', 'throttle:6,1'])
    ->name('admin.verification.verify');
