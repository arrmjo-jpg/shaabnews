# Architecture — بنية المشروع، الوحدات، والطبقات

**الحالة: تصميم معماري مبني على خط الأساس المعتمَد** ([`requirements/`](../requirements/00-VISION-AND-SCOPE.md)
و[`requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md`](../requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md)).
كل قرار هنا يُبرَّر بمرجع لمتطلب موثَّق، لا بتفضيل عام. **المبدأ الحاكم لكل ما يلي** (`00-VISION-AND-SCOPE.md`
§٢): الـ Backend مصدر الحقيقة الوحيد؛ هذا التطبيق عميل ذكي يعرض ويجمع، لا يعيد تنفيذ منطق أعمال.

المستندات المرافقة: [`01-NAVIGATION-AND-STATE.md`](01-NAVIGATION-AND-STATE.md) ·
[`02-API-LAYER-AND-ERROR-HANDLING.md`](02-API-LAYER-AND-ERROR-HANDLING.md) ·
[`03-AUTHENTICATION-FLOW.md`](03-AUTHENTICATION-FLOW.md) ·
[`04-MEDIA-UPLOAD-PIPELINE.md`](04-MEDIA-UPLOAD-PIPELINE.md) ·
[`05-DESIGN-SYSTEM-INTEGRATION.md`](05-DESIGN-SYSTEM-INTEGRATION.md)

---

## ١) قرار تنظيمي جوهري: Feature-First لا Layer-First

البنية العليا لـ `lib/` منظَّمة **حسب الوحدة الوظيفية (Feature)**، لا حسب الطبقة التقنية. السبب مباشر
من `00-VISION-AND-SCOPE.md` §٨: الهدف طويل المدى أن تكون الوحدات (أخبار/ريلز/فيديو/جريدة) **قابلة
للتفعيل/التعطيل بشكل مستقل** لمشاريع AlphaCMS أخرى مستقبلاً. تنظيم Layer-First (`lib/screens/`,
`lib/models/`, `lib/services/` مبعثرة أفقيًا) يجعل عزل/حذف وحدة كاملة لاحقًا مؤلمًا؛ Feature-First
يجعله نقل مجلد واحد.

```
lib/
  core/                         # عابر لكل الوحدات — لا شيء خاص بميزة واحدة هنا
    config/                     # ثوابت البيئة (Base URL...)، بلا واجهة تبديل بيئة داخل التطبيق
    network/                    # عميل dio + Interceptors + عقد ApiFailure/Result
    storage/                    # أغلفة flutter_secure_storage + shared_preferences
    auth/                       # AuthController (حالة الجلسة والصلاحيات) — يُستهلَك من كل الوحدات
    router/                     # إعداد go_router + route guards قائمة على الصلاحيات
    theme/                      # نظام التصميم (راجع 05-DESIGN-SYSTEM-INTEGRATION.md)
    l10n/                       # ملفات ARB + glue لـ gen-l10n
    widgets/                    # عناصر واجهة "غبية" مشتركة (أزرار، حالات فارغة/تحميل/خطأ)
    utils/                      # دوال نقية صغيرة فقط (لا حالة، لا اعتماديات)

  features/
    auth/                       # واجهة تسجيل الدخول فقط (presentation/) — راجع ⚠ أدناه
    home/                       # Dashboard الرئيسية
    articles/                   # الأخبار
    reels/                      # الريلز
    videos/                     # الفيديوهات
    media/                      # مسار رفع الوسائط المشترك (راجع 04-MEDIA-UPLOAD-PIPELINE.md)
    settings/                   # شاشة الحساب/الإعدادات

  app.dart                      # MaterialApp.router + ProviderScope الجذر
  main.dart                     # bootstrap فقط (تهيئة Firebase عند دمجه، تشغيل runApp)
```

**قاعدة صارمة:** لا يستورد أي ملف داخل `features/x/` من `features/y/` مباشرة. أي مشاركة بين وحدتين
تمر عبر `core/` فقط. هذا يحافظ على استقلالية كل وحدة فعليًا، لا اسميًا فقط.

## ٢) داخل كل وحدة (Feature Module) — ثلاث طبقات خفيفة عمدًا

```
features/articles/
  data/
    article_dto.dart            # نماذج JSON يدوية (fromJson/toJson) — مطابقة حرفية لـ ArticleResource
    article_repository_impl.dart
  domain/
    article.dart                # كيان بسيط غير قابل للتغيير (immutable)، لا منطق فيه
    article_repository.dart     # العقد المجرَّد (abstract class) — الواجهة العامة للوحدة
  presentation/
    controllers/                # Riverpod Notifiers (حالة الشاشات)
    screens/
    widgets/
```

### لماذا **ثلاث** طبقات لا Clean Architecture الكاملة (بلا طبقة UseCase منفصلة)؟

هذا قرار واعٍ، لا اختصارًا مُهملاً. الأنماط التعليمية لـ Clean Architecture في Flutter تضيف عادة طبقة
UseCase/Interactor منفصلة بين الـ Repository والـ Controller. هذه الطبقة تُبرَّر عندما يوجد **منطق
أعمال حقيقي يستحق العزل والاختبار المستقل** عن الواجهة. في تطبيقنا، **منطق الأعمال بالكامل يعيش في
الـ Backend** (`00-VISION-AND-SCOPE.md` §٢) — الـ Repository هنا يستدعي endpoint ويحوّل JSON فقط، لا
يتخذ قرار عمل واحد. إضافة طبقة UseCase فوقه تعني كتابة صف بلا منطق حقيقي لكل عملية — ceremony بلا
عائد، يتعارض مع قيد "فريق صغير/أقل تعقيد ممكن". **الـ Controller (Riverpod Notifier) يستدعي الـ
Repository مباشرة.**

**الاستثناء الوحيد المقبول لإضافة طبقة تنسيق (Orchestration) لاحقًا:** عندما تحتاج شاشة واحدة تنسيق
أكثر من نداء Repository معًا (مثال: إنشاء ريل يتطلب أولاً رفع الوسائط ثم إنشاء السجل). هذا **ليس منطق
أعمال، بل تنسيق واجهة** — يبقى داخل الـ Controller نفسه في V1؛ يُستخرَج لصف Orchestrator منفصل فقط
لو تكرر نفس التنسيق عبر أكثر من شاشة (قاعدة "لا تُجرِّد قبل التكرار الثالث").

## ٣) عقد الـ Repository — مثال ملموس (`articles`)

هذا مثال توضيحي فقط لشكل العقد المتوقَّع — التنفيذ الفعلي في مرحلة البرمجة، لا هنا:

```dart
// features/articles/domain/article_repository.dart
abstract class ArticleRepository {
  Future<Result<PaginatedList<Article>>> list(ArticleListParams params);
  Future<Result<Article>> show(int id);
  Future<Result<Article>> create(ArticleUpsertPayload payload);
  Future<Result<Article>> update(int id, ArticleUpsertPayload payload);
  Future<Result<void>> transitionStatus(int id, {required String action});
}
```

**قاعدة تصميم صارمة:** كل توقيع دالة هنا يقابل نقطة نهاية موثَّقة فعليًا في
[`../01-BACKEND-CONNECTIVITY.md`](../01-BACKEND-CONNECTIVITY.md) §٢.١ — **لا يُضاف أي توقيع دالة
"منطقي" أو "مريح" لا يقابله endpoint حقيقي.** مثال محظور: دالة `publishAndNotify()` تدمج نشرًا +
إشعارًا يدويًا من التطبيق — هذا قرار سير عمل يخص الـ Backend، لا التطبيق (راجع
[`../requirements/01-USERS-PERMISSIONS-WORKFLOW.md`](../requirements/01-USERS-PERMISSIONS-WORKFLOW.md) §٢).

`Result<T>` وتفاصيل معالجة الأخطاء موضَّحة في [`02-API-LAYER-AND-ERROR-HANDLING.md`](02-API-LAYER-AND-ERROR-HANDLING.md).

## ٤) النماذج (Models/DTOs) — يدوية حتى إشعار آخر

بحسب القرار المعتمَد في Package Baseline: `fromJson`/`toJson` تُكتَب يدويًا لكل نموذج، **بدون
`freezed`/`json_serializable`/`build_runner` حتى نصل لـ 20+ نموذجًا فعليًا**. كل DTO يقابل حرفيًا شكل
الاستجابة الموثَّق في `../01-BACKEND-CONNECTIVITY.md` (مثال: `ArticleData` بحقولها الكاملة). لا حقول
إضافية "قد تُفيد لاحقًا" — فقط ما يُستهلَك فعليًا.

## ٥.١) ⚠ تعديل حقيقي وقت التنفيذ: `auth` ليست ميزة كباقي الميزات

عند تنفيذ Sprint 1 فعليًا، تبيّن أن `AuthRepository` (العقد + التنفيذ) لا يمكن أن يعيش في
`features/auth/domain` كما رسمه هذا المستند أصلاً — لأن `core/auth/auth_controller.dart` (حالة
الجلسة العابرة لكل الوحدات، §١) يحتاج استدعاءه مباشرة، وهذا يعني استيراد `core/` لملف داخل
`features/` — عكس اتجاه الاعتماديات المقصود تمامًا.

**القرار الفعلي المعتمَد:** `AuthRepository` (العقد + `AuthRepositoryImpl` + `AdminUser`) تعيش بالكامل
داخل `core/auth/` وليس `features/auth/domain`. المبرر: تسجيل الدخول ليس "ميزة محتوى" نظيرة للأخبار/
الريلز/الفيديو (التي لا تعتمد إحداها على الأخرى) — هو بنية تحتية يعتمد عليها **كل** شيء في التطبيق
(الموجّه، كل Interceptor، كل شاشة عبر `hasPermission`). `features/auth/` أصبحت مخصَّصة **حصرًا**
لشاشات العرض (`presentation/screens/`: تسجيل الدخول، Splash) التي تستهلك `core/auth/` مثل أي ميزة
أخرى تمامًا — الاتجاه الصحيح محفوظ.

## ٥) الوحدة المشتركة `media/` — استثناء متعمَّد لقاعدة "لا استيراد بين ميزات"

مسار رفع الوسائط (تصوير→تحويل→ضغط→رفع) **مطابق تمامًا** عبر الأخبار/الريلز/الفيديوهات (نفس
`POST /admin/media`، نفس `media_asset_id` النهائي — `../01-BACKEND-CONNECTIVITY.md` §٣). ميزات
`articles`/`reels`/`videos` **يُسمح لها باستيراد `features/media/`** تحديدًا (الاستثناء الوحيد لقاعدة
العزل في §١) — لأن `media` بمثابة امتداد لـ `core/` وظيفيًا (خدمة عابرة)، وُضعت في `features/` فقط
لأن لها شاشات/widgets عرض تقدّم خاصة بها تستحق التصنيف كوحدة، لا لأنها معزولة منطقيًا عن البقية.
تفاصيل كاملة في [`04-MEDIA-UPLOAD-PIPELINE.md`](04-MEDIA-UPLOAD-PIPELINE.md).

## ٦) تسمية الملفات والصفوف — قواعد ثابتة

- ملفات: `snake_case.dart`. أصناف: `PascalCase`. مزوّدات Riverpod: `camelCaseProvider`.
- DTO يحمل لاحقة `Dto` أو `Data` (مطابقةً لتسمية الباك إند نفسها، مثال `ArticleData` — تسهيلاً على أي
  مطوّر يقرأ `01-BACKEND-CONNECTIVITY.md` بالتوازي مع الكود). الكيان النظيف في `domain/` بلا لاحقة
  (`Article`).
- لا اختصارات غامضة (`ArtCtrl` ممنوع، `ArticleController` مطلوب) — الوضوح أهم من قصر الاسم لمشروع
  يُتوقَّع أن يعيش طويلاً بفريق صغير قد يتغيّر أفراده.
