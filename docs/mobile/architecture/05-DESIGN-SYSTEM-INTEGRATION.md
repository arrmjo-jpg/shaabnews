# Architecture — دمج نظام التصميم (Design System Integration)

مرجع: [`../requirements/05-UX-SCREENS-AND-SETTINGS.md`](../requirements/05-UX-SCREENS-AND-SETTINGS.md)
§١ — "الحفاظ على الهوية البصرية لـ AlphaCMS... اتساق لا نسخ حرفي". القيم أدناه **مأخوذة مباشرة** من
`admin-frontend/src/styles/globals.css` (المصدر الفعلي الوحيد للهوية البصرية اليوم) — لا قيم مُخترَعة.

---

## ١) الألوان — نفس القيم الأصلية بصيغة HSL (لا تحويل يدوي عرضة للخطأ)

بدل تحويل قيم HSL من `globals.css` إلى Hex يدويًا (مخاطرة أخطاء تقريب)، تُستخدَم قيم HSL **نفسها
حرفيًا** عبر `HSLColor.fromAHSL(...).toColor()` — مصدر حقيقة واحد مطابق للويب تمامًا:

```dart
// core/theme/app_colors.dart
class AppColors {
  // القيم من admin-frontend/src/styles/globals.css — Light Mode
  static final primaryLight   = const HSLColor.fromAHSL(1, 202, 0.44, 0.41).toColor(); // #3B7597 (العلامة التجارية)
  static final backgroundLight = const HSLColor.fromAHSL(1, 210, 0.40, 0.99).toColor();
  static final foregroundLight = const HSLColor.fromAHSL(1, 215, 0.28, 0.17).toColor();
  static final cardLight      = const HSLColor.fromAHSL(1, 0, 0, 1.00).toColor();
  static final destructiveLight = const HSLColor.fromAHSL(1, 0, 0.72, 0.51).toColor();
  static final borderLight    = const HSLColor.fromAHSL(1, 214, 0.24, 0.91).toColor();

  // القيم من نفس الملف — .dark
  static final primaryDark    = const HSLColor.fromAHSL(1, 202, 0.58, 0.60).toColor();
  static final backgroundDark = const HSLColor.fromAHSL(1, 215, 0.19, 0.22).toColor();
  static final foregroundDark = const HSLColor.fromAHSL(1, 210, 0.24, 0.95).toColor();
  static final cardDark       = const HSLColor.fromAHSL(1, 215, 0.17, 0.27).toColor();
  static final destructiveDark = const HSLColor.fromAHSL(1, 0, 0.62, 0.54).toColor();
  static final borderDark     = const HSLColor.fromAHSL(1, 215, 0.13, 0.38).toColor();
}
```

**قاعدة صيانة:** لو تغيّرت قيم `globals.css` مستقبلاً (تحديث هوية بصرية)، هذا الملف الوحيد الذي يُعدَّل
— انسخ القيم الرقمية الثلاث (Hue/Saturation/Lightness) كما هي، لا حاجة لأي أداة تحويل خارجية.

## ٢) `ThemeData` — Light و Dark عبر `ColorScheme`، لا Widgets مُلوَّنة يدويًا

```dart
ThemeData buildAppTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: isDark ? AppColors.primaryDark : AppColors.primaryLight,
    surface: isDark ? AppColors.cardDark : AppColors.cardLight,
    error: isDark ? AppColors.destructiveDark : AppColors.destructiveLight,
    // ... باقي الحقول من نفس القيم أعلاه
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
    fontFamily: 'Tajawal', // الخط الافتراضي — راجع §٣ للاستثناء اللاتيني
  );
}
```

**الوضع الليلي متطلب V1 إلزامي** (`../requirements/05-...md` §١) — كلا الـ `ThemeData` جاهزان من أول
تشغيل للتطبيق، لا يُضافان لاحقًا كتحسين. تبديل الوضع في الإعدادات يغيّر `ThemeMode` فقط (`system`/
`light`/`dark`) عبر Riverpod (`themeModeProvider` مبني فوق `shared_preferences`).

## ٣) الخطوط — Tajawal (عربي) + Inter (لاتيني)، أصول محلية لا شبكة

`globals.css` يستورد الخطين عبر Google Fonts CDN (`@import url(...)`) — هذا **غير مناسب لتطبيق
موبايل** (يعتمد اتصالاً عند أول تشغيل، يتعارض مع فلسفة "التعامل الذكي مع شبكة ضعيفة"
`../requirements/02-...md`). **القرار: تضمين ملفات الخطوط محليًا كأصول ثابتة** (`assets/fonts/`)
عبر تعريف `fonts:` في `pubspec.yaml` — **بلا أي حزمة جديدة** (لا `google_fonts` ولا غيرها؛ إضافة
أصول Font لا تُعتبر "حزمة" وفق قرار Package Baseline، ولا تحتاج إعادة فتحه).

```yaml
# pubspec.yaml — يُضاف عند مرحلة التنفيذ، ليس الآن
flutter:
  fonts:
    - family: Tajawal
      fonts:
        - asset: assets/fonts/Tajawal-Regular.ttf
        - asset: assets/fonts/Tajawal-Medium.ttf
          weight: 500
        - asset: assets/fonts/Tajawal-Bold.ttf
          weight: 700
    - family: Inter
      fonts:
        - asset: assets/fonts/Inter-Regular.ttf
        - asset: assets/fonts/Inter-Medium.ttf
          weight: 500
        - asset: assets/fonts/Inter-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Inter-Bold.ttf
          weight: 700
```

**قاعدة استخدام مطابقة للويب** (`globals.css` سطر 63-65: `html[lang='en'] body` يستخدم Inter):
`Tajawal` هو خط النص الافتراضي؛ `Inter` يُستخدَم فقط في سياقات نص إنجليزي صريح (محتوى `locale=en`) —
منطق التبديل يعيش في `core/theme/`، لا في كل شاشة على حدة.

## ٤) الأنصاف القطرية (Radius) والمسافات — من نفس المصدر

`--radius: 0.9rem` في `globals.css` = **14.4px تقريبًا** (`0.9rem × 16px`). يُستخدَم كقيمة موحّدة
لـ `BorderRadius` في `CardTheme`/`ButtonTheme`/`InputDecorationTheme` — لا قيم Radius مختلفة متناثرة
عبر الشاشات.

## ٥) RTL — من SDK Flutter، بلا حزمة (تكرار مقصود من `08-PACKAGE-ARCHITECTURE-AUDIT.md`)

`flutter_localizations` + `Directionality` يوفّران دعم RTL كاملاً تلقائيًا بمجرد أن تكون لغة الواجهة
`ar`. **قاعدة تصميم:** كل تخطيط (Layout) في المشروع يُبنى بخصائص اتجاهية نسبية (`start`/`end`) لا
مطلقة (`left`/`right`) — `EdgeInsetsDirectional`، `Alignment.centerStart` وليس
`EdgeInsets`/`Alignment.centerLeft` — لضمان انعكاس تلقائي صحيح بين عربي/إنجليزي دون أي كود شرطي يدوي
لكل شاشة.

## ٦) الترجمة — `gen-l10n` الرسمي (قرار معتمَد، لا `easy_localization`)

```
lib/l10n/
  app_ar.arb        # اللغة الافتراضية (Template)
  app_en.arb
```
`flutter gen-l10n` يُشغَّل تلقائيًا ضمن `flutter build`/`flutter run` (مُفعَّل عبر `generate: true` في
`pubspec.yaml`) — ينتج `AppLocalizations` مُكتوبة نوعيًا (Type-safe) بلا أي حزمة خارجية. تبديل اللغة
وقت التشغيل (متطلب صريح، `../requirements/05-...md` §١) يُنفَّذ عبر إعادة بناء `MaterialApp.router`
بـ `locale` من `localeProvider` (Riverpod، مبني فوق `shared_preferences`) — التعقيد الإضافي الطفيف
المذكور في Package Baseline عند رفض `easy_localization` يعيش هنا تحديدًا: إعادة بناء الشجرة كاملة عند
تبديل اللغة، بدل تحديث محلي أخف. مقبول بوعي مقابل صفر تبعية خارجية.

## ٧) عناصر واجهة مشتركة (`core/widgets/`) — تُبنى مرة، تُستخدَم في كل شاشة

`AppButton`, `AppCard`, `ResultView` (`02-API-LAYER-AND-ERROR-HANDLING.md` §٦), `EmptyState`,
`LoadingIndicator` — كل عنصر يقرأ الألوان/الخطوط من `Theme.of(context)` حصرًا، **لا لون أو خط مكتوب
يدويًا (Hardcoded) داخل أي شاشة ميزة (`features/`)**. هذا يضمن أن أي تغيير مستقبلي في الهوية البصرية
(كما يحدث على الويب) ينعكس تلقائيًا بتعديل `core/theme/` فقط.
