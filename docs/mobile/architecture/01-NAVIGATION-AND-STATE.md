# Architecture — التنقّل (go_router) وتدفّق إدارة الحالة (Riverpod)

مرجع: [`00-PROJECT-STRUCTURE-AND-LAYERS.md`](00-PROJECT-STRUCTURE-AND-LAYERS.md).

---

## ١) التنقّل — بنية المسارات

**قرار مفتوح عمدًا لم يُحسم هنا:** نمط عرض التنقّل الرئيسي (Bottom Navigation Bar / Drawer / غيره)
تُرك مفتوحًا صراحة في
[`../requirements/05-UX-SCREENS-AND-SETTINGS.md`](../requirements/05-UX-SCREENS-AND-SETTINGS.md) §٣
— **لا يحسمه هذا المستند.** بنية المسارات أدناه مصمَّمة لتعمل مع أي نمط عرض يُختار لاحقًا (`ShellRoute`
في `go_router` تحمل أي widget غلاف — Bottom Nav أو Drawer سيّان على مستوى الـ Router).

```
/login                          # بلا Shell — شاشة مستقلة
/                                # ShellRoute (الغلاف الرئيسي بعد الدخول)
  ├── /                          # الرئيسية (Dashboard)
  ├── /articles
  │     ├── /articles/new
  │     └── /articles/:id
  ├── /reels
  │     ├── /reels/new
  │     └── /reels/:id
  ├── /videos
  │     ├── /videos/new
  │     └── /videos/:id
  └── /settings
        └── /settings/sessions
```

### حراسة المسارات (Route Guards) — على الصلاحيات الفعلية، لا الأدوار

`redirect` في `go_router` يُطبَّق على مستويين، كلاهما يقرآن حالة من Riverpod (`ref.read`) لا من اسم دور:

1. **حارس المصادقة:** لا يوجد توكن صالح → إعادة توجيه لـ `/login`. يوجد توكن ومستخدم في `/login` →
   إعادة توجيه لـ `/`.
2. **حارس الصلاحية لكل مسار:** كل مسار قسم (`/articles`, `/reels`, `/videos`) يتحقق من صلاحية العرض
   المقابلة (`articles.view`, `reels.view`, `videos.view`) قبل الدخول — تطبيق حرفي لقاعدة
   [`../requirements/01-USERS-PERMISSIONS-WORKFLOW.md`](../requirements/01-USERS-PERMISSIONS-WORKFLOW.md)
   §١: **لا منطق ثابت باسم الدور إطلاقًا.** لو لم تظهر الصلاحية أصلاً في التنقّل الرئيسي، لا داعي حتى
   لحارس مسار (الزر نفسه لن يظهر) — الحارس شبكة أمان ثانية فقط (مثال: رابط مباشر/Deep Link لقسم لا
   يملك المستخدم صلاحيته).

### التجهيز البنيوي لإشعارات مستقبلية (بلا تفعيل فعلي الآن)

بنية `/articles/:id` كمسار مسمّى حقيقي (لا حالة داخلية مموَّهة) تجعل أي Deep Link مستقبلي من إشعار
حقيقي (`../requirements/03-NOTIFICATIONS.md`) **مجرد استدعاء `context.go('/articles/42')`** حين تُبنى
تلك الميزة — لا إعادة تصميم توجيه لاحقًا. هذا **تجهيز بنيوي فقط**، لا أي كود إشعار فعلي الآن (يطابق
القرار الصريح في
[`../requirements/07-FUTURE-AND-OPEN-DECISIONS.md`](../requirements/07-FUTURE-AND-OPEN-DECISIONS.md) §٣).

---

## ٢) تدفّق إدارة الحالة (Riverpod) — بلا Code Generation

بحسب Package Baseline: صيغة يدوية (`NotifierProvider`/`AsyncNotifierProvider`/`FutureProvider`
مباشرة)، لا `@riverpod` annotations ولا `build_runner`.

### تسلسل الاعتماديات (Dependency Graph) — طبقة تلو طبقة

```
dioProvider                         (core/network)
   └── articleRepositoryProvider    (features/articles/data) — يعتمد على dioProvider
        └── articleListNotifierProvider   (features/articles/presentation) — AsyncNotifier، يعتمد على الـ Repository
             └── ArticlesListScreen        — ref.watch(articleListNotifierProvider)
```

كل سهم اعتمادية **باتجاه واحد فقط** (الأعلى لا يعرف بوجود الأسفل). `dioProvider` لا يعرف شيئًا عن
`Article`؛ `articleRepositoryProvider` لا يعرف شيئًا عن واجهة المستخدم.

### نمط قوائم/تفاصيل — `AsyncNotifier`

كل شاشة قائمة أو تفصيل تُبنى فوق `AsyncNotifier<T>` — يعطي `AsyncValue` (`loading`/`error`/`data`)
جاهزًا، يُطابَق مباشرة مع نوع `Result` القادم من الـ Repository (راجع
[`02-API-LAYER-AND-ERROR-HANDLING.md`](02-API-LAYER-AND-ERROR-HANDLING.md)):

```dart
class ArticleListNotifier extends AsyncNotifier<PaginatedList<Article>> {
  @override
  Future<PaginatedList<Article>> build() => _fetch();

  Future<PaginatedList<Article>> _fetch() async {
    final repo = ref.read(articleRepositoryProvider);
    final result = await repo.list(const ArticleListParams());
    return switch (result) {
      Ok(:final value) => value,
      Err(:final failure) => throw failure, // AsyncNotifier يحوّلها لـ AsyncError تلقائيًا
    };
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetch);
  }
}
```

**كل شاشة تعرض الحالات الثلاث بمكوّن موحّد واحد** (`ResultView` في `core/widgets/`) — لا تكرار منطق
"لو تحميل اعرض Spinner، لو خطأ اعرض رسالة" في كل شاشة على حدة.

### حالة المصادقة — Provider عابر لكل الوحدات

`authControllerProvider` (في `core/auth/`) يحمل: التوكن (عبر `flutter_secure_storage`)، بيانات
المستخدم، ومجموعة الصلاحيات `Set<String>` من `GET /admin/auth/me`. **كل الوحدات تقرأ منه**، لا واحدة
تُعيد تنفيذ منطق "هل أنا مسجَّل دخول" بنفسها. تفصيل كامل في
[`03-AUTHENTICATION-FLOW.md`](03-AUTHENTICATION-FLOW.md).

### قاعدة صارمة: لا حالة عامة متغيّرة خارج شجرة Riverpod

لا `late` متغيرات ثابتة (Static/Singleton) خارج نظام الـ Provider — هذا بالضبط ما رُفضت لأجله `GetX`
في Package Baseline (`../requirements/08-...md`، قسم الرفض). أي حالة تحتاج مشاركتها بين Widgets تمر
عبر Provider، قابلة للاختبار والاستبدال (`ProviderScope overrides`) في الاختبارات لاحقًا.
