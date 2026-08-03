# ADR-012: مسار `mobile-login` مخصَّص للموبايل، معفى من reCAPTCHA — الويب لا يتغيّر

## القرار
`routes/api/v1/admin-auth.php` يضيف مساراً جديداً:

```php
Route::post('/mobile-login', [AdminAuthController::class, 'login'])
    ->middleware(['throttle:admin.login']);
```

يستدعي **نفس** `AdminAuthController::login` (وبالتالي نفس `AdminLoginRequest` ونفس
`AdminLoginAction`) المستخدَم في `/admin/auth/login` الحالي — لا فرق في منطق التحقّق، رفض الأدوار غير
الإدارية، فحص `email_verified_at`، أو شكل الاستجابة. **الفرق الوحيد هو الـ Middleware:** المسار الجديد
لا يحمل `recaptcha:admin_login`، بينما `/admin/auth/login` (الذي يبقى يخدم `admin-frontend` على الويب)
لم يتغيّر إطلاقاً ويبقى محمياً بـ reCAPTCHA كما كان.

تطبيق الموبايل (`admin-app`) يستدعي `/admin/auth/mobile-login` حصراً — `AuthRepositoryImpl.login()`
لا يرسل `recaptcha_token` بعد الآن؛ الحقل حُذف بالكامل من `AuthRepository`/`AuthController`/
`LoginScreen` (كان دائماً `null` عملياً، ولم يُستهلَك من أي شاشة — انظر "الأثر" أدناه).

## السبب
reCAPTCHA v3 **مصمَّم أساساً لصفحة ويب** يُحمَّل فيها JS SDK من Google ويُنفَّذ `grecaptcha.execute()`
داخل سياق متصفح حقيقي مرتبط بأصل (origin) مسجَّل في Google Console. تطبيق Flutter **native** لا يملك
"صفحة" أو "أصل" بالمعنى الذي تفحصه Google — طلب `Dio` الخام لا يمر بأي تحدٍّ JS إطلاقاً، ولذلك **لا
يمكنه إنتاج `recaptcha_token` صالح مهما أُضيف من دومينات في إعدادات Google** (تحقّق مباشر: تسجيل الدخول
من التطبيق على المحاكي بعد إصلاح `API_BASE_URL` وصل فعلياً للخادم لكن رُفض بـ `422` — رسالة تحقّق
reCAPTCHA صريحة، لا خطأ شبكة).

هذه كانت نقطة مفتوحة موثَّقة صراحة منذ بداية التخطيط
(`docs/mobile/requirements/03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md` §١، ومعلَّقة بعلامة ⚠ في
`03-AUTHENTICATION-FLOW.md`) — أي أنها لم تُكتشَف الآن، بل كانت اعتمادية معروفة يجب حسمها قبل اعتبار
تسجيل الدخول جاهزاً فعلياً. صاحب المنتج حسمها بقرار صريح: استثناء تسجيل دخول الموبايل من reCAPTCHA، مع
إبقاء reCAPTCHA كما هي تماماً للويب.

## البدائل المرفوضة
- **Play Integrity API / App Attest (device attestation حقيقي)** — الحل الأصح أمنياً على المدى الطويل
  (يثبت أن الطلب قادم من نسخة تطبيق حقيقية غير معدَّلة على جهاز حقيقي)، لكنه تعقيد تكامل كامل (مفاتيح
  Google Cloud، تحقّق توقيع الحزمة، منطق تحقّق إضافي في الـ Backend) غير متناسب مع حجم هذا القرار —
  يستحق تقييماً منفصلاً لاحقاً إن ثبتت الحاجة الفعلية لحماية أقوى من محاولات القوة الغاشمة.
- **WebView مخصَّص لصفحة دخول خفيفة تلتقط تحدي reCAPTCHA** — يحل المشكلة تقنياً، لكنه يفرض تجربة مستخدم
  غريبة (شاشة ويب داخل تطبيق native لخطوة واحدة فقط)، ويعيد فعلياً كل مشاكل WebView (أداء، حقن سكربتات،
  عدم اتساق مع Design System) مقابل فائدة أمنية محدودة — reCAPTCHA v3 أصلاً "صامتة" (score-based) لا
  تتطلب تفاعل مستخدم مرئياً، فإخفاء صفحة كاملة خلفها غير مبرَّر.
- **تعطيل reCAPTCHA بالكامل من الإعدادات (`recaptcha_enabled=false`)** — يفقد حماية الويب أيضاً، رغم
  أن المطلوب فقط استثناء الموبايل. رُفض لأنه يوسّع أثر القرار لواجهة لم تطلب تغييراً (`admin-frontend`).
- **قراءة `User-Agent` أو Header مخصَّص للتمييز بين طلب ويب وموبايل على نفس المسار `/login`** — لا يضيف
  أي حماية حقيقية (أي عميل HTTP يستطيع تقليد نفس الـ Header أو الـ User-Agent فوراً)، ويزيد تعقيد
  Middleware واحد بمنطق فرعي بدل مسارين واضحين — مسار منفصل أوضح ويعطي نفس المستوى الفعلي من الحماية
  (أي "تمييز" بين عميل ويب وعميل native عبر HTTP وحده قابل للتزييف بنفس السهولة أياً كانت الآلية).

## الأثر
- **مقايضة أمنية صريحة ومقصودة، لا فقدان صامت:** الحماية الفعلية المفقودة على مسار الموبايل هي فحص
  score/action من Google — لكن هذا الفحص لم يكن يعمل أصلاً على الموبايل (كان يرفض 100% من محاولات
  الدخول الحقيقية بلا استثناء، وليس فقط الزائفة). الحماية الباقية والمُطبَّقة فعلياً على المسارين معاً:
  `throttle:admin.login` (5 محاولات/دقيقة لكل IP — نفس الحد الأكثر صرامة في كل النظام)، رفض قاطع لأي
  دور غير إداري في `AdminLoginAction`، وتسجيل نشاط دخول (Audit) عند النجاح.
- `/admin/auth/login` (الويب) **لم يُمسّ إطلاقاً** — لا تغيير في السلوك أو المستوى الأمني لـ
  `admin-frontend`.
- حذف `recaptchaToken`/`recaptcha_token` بالكامل من `admin-app/lib` (كان معاملاً اختيارياً غير مُستخدَم
  فعلياً من أي شاشة، مع تعليق صريح في `LoginScreen` ينتظر هذا القرار بالضبط) — لا كود ميت متبقٍ.
- إضافة اختبارين في `tests/Feature/Auth/RecaptchaTest.php`:
  `exempts mobile login from recaptcha even when enabled` و
  `keeps web admin login enforcing recaptcha independently of the mobile exemption` — يثبتان أن
  الاستثناء مقصور على `/mobile-login` ولا يسرّب أثراً على `/login`.
- إن ثبتت لاحقاً حاجة فعلية لحماية أقوى ضد القوة الغاشمة على الموبايل تحديداً (مثلاً محاولات دخول آلية
  مكثفة)، الخيار المرشَّح التالي هو device attestation (Play Integrity/App Attest) لا العودة لـ
  reCAPTCHA — reCAPTCHA v3 غير قابل للعمل من عميل native بنيوياً، بصرف النظر عن أي إعداد دومين.

## المرجع
[`routes/api/v1/admin-auth.php`](../../../../routes/api/v1/admin-auth.php) ·
[`tests/Feature/Auth/RecaptchaTest.php`](../../../../tests/Feature/Auth/RecaptchaTest.php) ·
[`admin-app/lib/core/auth/auth_repository_impl.dart`](../../../../admin-app/lib/core/auth/auth_repository_impl.dart) ·
[`docs/mobile/01-BACKEND-CONNECTIVITY.md`](../../01-BACKEND-CONNECTIVITY.md) §١ ·
[`docs/mobile/03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md`](../../03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md) §١ ·
[`03-AUTHENTICATION-FLOW.md`](../03-AUTHENTICATION-FLOW.md) §١
