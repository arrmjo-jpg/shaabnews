# Architecture — تدفّق المصادقة

مرجع: [`../01-BACKEND-CONNECTIVITY.md`](../01-BACKEND-CONNECTIVITY.md) §١ (آلية Sanctum الفعلية) و
[`../requirements/04-SECURITY.md`](../requirements/04-SECURITY.md).

---

## ١) تسلسل تسجيل الدخول

```
شاشة الدخول (بريد + كلمة مرور)
  → POST /admin/auth/login  (+ recaptcha_token إن كانت مفعّلة — انظر ⚠ أدناه)
  → نجاح: { token, user }
  → تخزين التوكن في flutter_secure_storage فورًا (لا يُترك في الذاكرة فقط)
  → GET /admin/auth/me  (تأكيد + جلب permissions[] الفعلية)
  → تحديث authControllerProvider بالحالة الكاملة (user + permissions)
  → go_router redirect → '/'
```

**⚠ اعتماد غير محسوم (موثَّق في `../requirements/03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md` §١):**
لو كانت حماية reCAPTCHA v3 مفعَّلة فعليًا على `/admin/auth/login` في هذا التنصيب، شاشة الدخول تحتاج
حلاً تقنيًا لالتقاط `recaptcha_token` (لا حل SDK أصلي مباشر لـ reCAPTCHA v3 من تطبيق Flutter). **هذا
قرار أمني منفصل يجب حسمه قبل بناء شاشة الدخول الفعلية** — التصميم هنا يفترض وجود الحقل اختياريًا في
جسم الطلب دون افتراض الحل التقني له.

## ٢) تسلسل بدء التشغيل (Bootstrap) — كل فتحة تطبيق

```
main() → قراءة التوكن من flutter_secure_storage
  ├─ لا يوجد توكن → '/login'
  └─ يوجد توكن →
       فحص "قفل التطبيق" مفعَّل؟ (shared_preferences flag)
         ├─ نعم → تحدٍّ local_auth (بصمة/PIN) قبل أي عرض لمحتوى → نجاح → استكمال
         └─ لا → استكمال مباشرة
       → GET /admin/auth/me (تحقّق من صلاحية التوكن + تحديث الصلاحيات — قد تكون تغيّرت من لوحة التحكم)
         ├─ 200 → authControllerProvider = مُصادَق، توجيه '/'
         └─ 401 → مسح التخزين الآمن بالكامل → '/login'
```

**قاعدة مهمة:** `GET /admin/auth/me` يُستدعى **في كل بدء تشغيل**، لا يُكتفى بوجود توكن محلي فقط —
الصلاحيات ديناميكية (`../01-BACKEND-CONNECTIVITY.md` §٦) وقد تُعدَّل من لوحة التحكم بين جلسة وأخرى.

## ٣) قفل التطبيق (Biometric/PIN) — دورة حياة التطبيق لا فقط بدء التشغيل

`local_auth` challenge يُشغَّل أيضًا عند **العودة من الخلفية** (`AppLifecycleState.resumed`)، بعد مدة
خمول قابلة للتهيئة — لا فقط عند فتح التطبيق أول مرة. هذا يمنع سيناريو "قفلت التطبيق بالبصمة لكن تركته
مفتوحًا خلف تطبيقات أخرى ثم عاد بلا تحدٍّ".

**قرار مؤجَّل صراحة (خارج V1):** مدة الخمول الدقيقة قبل طلب التحدي مجددًا — قيمة تُضبط تجريبيًا وقت
التنفيذ، ليست قرار Architecture.

## ٤) لا Refresh Token — التعامل مع انتهاء الصلاحية (7 أيام)

الباك إند **لا يوفّر Refresh Token** (`../01-BACKEND-CONNECTIVITY.md` §١). أي `401` من أي نقطة نهاية
في أي وقت (وليس فقط عند بدء التشغيل) يُعالَج **مركزيًا** عبر `RetryInterceptor`
(`02-API-LAYER-AND-ERROR-HANDLING.md` §٣):

```dart
void forceLogout() async {
  await ref.read(secureStorageProvider).clear();
  state = const AuthState.unauthenticated();
  ref.read(routerProvider).go('/login'); // من أي شاشة، في أي لحظة
}
```

لا شاشة فردية تتعامل مع 401 بنفسها — القرار مركزي واحد يعمل بغض النظر عن أي طلب API فشل.

## ٥) اشتقاق الصلاحيات — القاعدة الأهم في كل هذا المستند

`authControllerProvider` يحمل `Set<String> permissions` من استجابة `/admin/auth/me`. **كل واجهة في
التطبيق** تستهلك هذه المجموعة عبر Helper واحد:

```dart
bool hasPermission(WidgetRef ref, String permission) =>
    ref.watch(authControllerProvider).permissions.contains(permission);
```

**ممنوع صراحة في كل الكود** (يطابق حرفيًا
[`../requirements/01-USERS-PERMISSIONS-WORKFLOW.md`](../requirements/01-USERS-PERMISSIONS-WORKFLOW.md) §١):
```dart
// ❌ محظور تمامًا في أي مكان بالمشروع
if (user.role == 'editor') { ... }
```
كل زر نشر/حذف/تعديل/اعتماد يُغلَّف بـ `if (hasPermission(ref, 'articles.publish'))` أو ما يعادله —
لا استثناء واحد.

## ٦) تسجيل الخروج وإدارة الجلسات

- **خروج محلي طوعي:** `POST /admin/auth/logout` (يُبطل توكن هذا الجهاز فقط) → مسح التخزين المحلي →
  `'/login'`.
- **الجلسات النشطة (شاشة الإعدادات):** تُستهلَك مباشرة من `GET/DELETE /admin/profile/sessions/*`
  الموجودة فعليًا (`../01-BACKEND-CONNECTIVITY.md` §١) — لا منطق جلسات محلي إضافي، الباك إند يملك
  الحقيقة الكاملة لكل الأجهزة المسجَّلة.
