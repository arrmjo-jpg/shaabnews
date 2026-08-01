# Design System Specification — admin-app (Flutter)

**هذا توثيق مكوّنات نظام تصميم (Tokens + أنماط استخدام)، وليس UI Design فعليًا (لا Mockups/Figma).**
مكمِّل لـ [`05-DESIGN-SYSTEM-INTEGRATION.md`](05-DESIGN-SYSTEM-INTEGRATION.md) (الذي غطّى آلية الدمج:
كيف تصل القيم إلى `ThemeData`) — هذا المستند يحدد **القيم والأنماط لكل مكوّن** ليعتمدها التنفيذ لاحقًا
بلا قرارات مرتجلة أثناء البرمجة. كل قيمة إما **مصدرها الفعلي** `admin-frontend` (ألوان/خطوط/Radius)
أو **مُكيَّفة بوعي** لاصطلاحات Material 3 (تباعد/ارتفاع/شكل مكوّنات) مع توضيح صريح لأيهما.

---

## ١) الألوان (Colors)

القيم الأساسية موثَّقة بالكامل في `05-DESIGN-SYSTEM-INTEGRATION.md` §١ (`AppColors`، مصدرها
`globals.css`). هنا إضافة الألوان **الدلالية** غير الموجودة في تلك الملفات (Success/Warning/Info) —
**مُشتقَّة** بانسجام مع اللون الأساسي (نفس درجة التشبع/الإضاءة النسبية لـ `--primary`)، لا مُخترَعة
عشوائيًا:

| الاسم | الاستخدام | Light (HSL) | Dark (HSL) |
|---|---|---|---|
| `success` | نُشر/اعتماد ناجح | `142, 44%, 40%` | `142, 44%, 55%` |
| `warning` | بانتظار مراجعة/مجدوَل | `38, 80%, 50%` | `38, 80%, 62%` |
| `info` | تنبيه محايد | نفس `primary` | نفس `primary` |
| `destructive` | رفض/خطأ/حذف | من `globals.css` (موثَّق سابقًا) | من `globals.css` |

**قاعدة صارمة:** هذه الألوان الأربعة **فقط** هي مفردات اللون الدلالي في كامل التطبيق — لا يُستخدَم أي
لون خام (`Colors.green`, `Color(0xFF...)`) مباشرة داخل أي شاشة ميزة.

## ٢) الطباعة (Typography) — مقياس Material 3 مُطبَّق على Tajawal/Inter

Material 3 يعرّف مقياسًا موحّدًا (Display/Headline/Title/Body/Label). نتبنّاه حرفيًا كهيكل، بخط
`Tajawal` (العربية) عبر `TextTheme`:

| الطبقة | الحجم | الوزن | الاستخدام |
|---|---|---|---|
| `headlineSmall` | 24 | 700 (Bold) | عنوان شاشة رئيسي |
| `titleLarge` | 20 | 700 | عنوان بطاقة/قسم |
| `titleMedium` | 16 | 500 (Medium) | عنوان عنصر قائمة (مثال: عنوان خبر) |
| `bodyLarge` | 16 | 400 (Regular) | نص أساسي |
| `bodyMedium` | 14 | 400 | نص ثانوي/وصف |
| `labelLarge` | 14 | 500 | نص زر |
| `labelSmall` | 12 | 500 | Badge/Chip/طابع زمني |

## ٣) التباعد (Spacing) — شبكة 4dp (مطابقة للأساس الافتراضي لـ Tailwind في الويب، اتساق ضمني)

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `xs` | 4dp | تباعد بين أيقونة ونص ملاصق |
| `sm` | 8dp | تباعد داخلي لعناصر صغيرة (Chip) |
| `md` | 16dp | الحشو (Padding) القياسي لبطاقة/شاشة |
| `lg` | 24dp | تباعد بين أقسام داخل شاشة |
| `xl` | 32dp | تباعد بين شاشة فرعية وحافة كبرى |

## ٤) الانحناء (Radius) — من `globals.css` مباشرة (`--radius: 0.9rem` ≈ 14.4dp)

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `sm` | 8dp | Chip، Badge |
| `md` | **14dp** (القيمة الأصلية من الويب) | Card، Input، Dialog |
| `lg` | 20dp | Bottom Sheet (الحافة العلوية فقط) |
| `full` | دائري كامل | FAB، Avatar، Badge دائري |

## ٥) الارتفاع/الظل (Elevation) — فلسفة "ظلال ناعمة" من الويب، لا Material الافتراضي الثقيل

`globals.css` يستخدم ظلالاً ناعمة مُشتَّتة (`boxShadow.soft`/`soft-lg`)، لا ظلال Material الحادة
الافتراضية. **القرار:** استبدال نظام الارتفاع الافتراضي لـ Material 3 (طبقات Surface Tint القوية)
بظلال ناعمة مخصَّصة تحاكي نفس الإحساس البصري:

```dart
BoxShadow softShadow = BoxShadow(
  color: Colors.black.withOpacity(0.06),
  blurRadius: 16, offset: const Offset(0, 4),
);
```
تُستخدَم لكل `Card`/`Dialog`/`BottomSheet` — **لا** `elevation` الرقمي الافتراضي لـ Material مباشرة.

## ٦) الأزرار (Buttons)

| النوع | الاستخدام | المكوّن |
|---|---|---|
| Primary (مملوء) | الإجراء الرئيسي في الشاشة (حفظ، نشر) | `FilledButton` |
| Secondary (مُحدَّد) | إجراء ثانوي (إلغاء، رجوع) | `OutlinedButton` |
| Text | إجراء منخفض التأكيد داخل بطاقة | `TextButton` |
| Danger | حذف/رفض | `FilledButton` بلون `destructive` |

**حالة "جارٍ التنفيذ":** كل زر إجراء شبكي (نشر/حفظ) يعرض `CircularProgressIndicator` صغيرًا بدل
النص أثناء انتظار الاستجابة — **يُعطَّل الزر تلقائيًا** أثناء ذلك (منع نقرات مكرَّرة تُنشئ طلبات
مكررة).

## ٧) حقول الإدخال (Inputs)

حدود مرئية دائمًا (`InputDecorationTheme.border`) مطابقة للون `--input` من الويب، حلقة تركيز
(`focusedBorder`) بلون `--ring` (نفس `primary`). رسائل الخطأ تُعرَض أسفل الحقل مباشرة بلون
`destructive` — **مصدرها حرفيًا** `errors` من `ValidationFailure` (`02-API-LAYER-AND-ERROR-HANDLING.md`
§٥)، لا نص عام.

## ٨) البطاقات (Cards) والقوائم (Lists)

بطاقة قياسية: خلفية `card` (من `AppColors`) + Radius `md` + `softShadow`. **نمط عنصر قائمة موحّد**
(`ContentListTile`، يُستخدَم للأخبار/الريلز/الفيديوهات معًا بمعاملات مختلفة): صورة مصغّرة (Radius
`sm`) + `titleMedium` للعنوان + `StatusChip` (§١٣) + طابع زمني (`labelSmall`). **مكوّن واحد يُعاد
استخدامه عبر ثلاث ميزات** — لا إعادة بناء نفس التخطيط ثلاث مرات.

## ٩) الحالات الفارغة (Empty States)

نمط موحّد (`EmptyState` في `core/widgets/`): أيقونة كبيرة رمادية + نص توضيحي + زر إجراء اختياري
("لا توجد أخبار بعد" + زر "إنشاء خبر"). يُستخدَم أيضًا عند نتائج بحث/فلترة فارغة (نص مختلف: "لا نتائج
مطابقة").

## ١٠) حالات التحميل (Loading States)

**قرار متّسق مع Package Baseline** (حزمة `shimmer` Optional فقط): مؤشر تحميل بسيط
(`CircularProgressIndicator`) للتحميل الأولي لشاشة كاملة؛ **Skeleton بسيط يدوي** (مستطيلات رمادية
بـ Radius `sm` بلا حزمة) لقوائم أثناء التحديث (Pull-to-refresh) — لا Shimmer متحرّك في V1 ما لم يثبت
أنه يستحق التكلفة لاحقًا.

## ١١) حالات الخطأ (Error States)

تُبنى بالكامل فوق `ResultView`/`ApiFailure` الموثَّقين في
[`02-API-LAYER-AND-ERROR-HANDLING.md`](02-API-LAYER-AND-ERROR-HANDLING.md) §٦ — أيقونة تحذير + رسالة
مطابقة لنوع الفشل + زر "إعادة المحاولة" (ما عدا `UnauthorizedFailure` الذي يُعالَج بتوجيه تلقائي، لا
عرض خطأ إطلاقًا).

## ١٢) الأوراق السفلية (Bottom Sheets) والحوارات (Dialogs)

`showModalBottomSheet` (Radius `lg` للحافة العلوية) لإجراءات سريعة متعددة الخيارات (مثال: اختيار
مصدر الوسائط — كاميرا/معرض). `showDialog`/`AlertDialog` (Radius `md`) للتأكيدات الحرجة (حذف، تسجيل
خروج، رفض محتوى مع سبب) — **كلاهما بلا حزمة خارجية**، Flutter SDK مباشرة (قرار معتمَد سابقًا).

## ١٣) مؤشرات الحالة (Status Indicators / Chips) — مطابقة حرفية لحالات الباك إند

**لا حالات مُخترَعة** — القيم مطابقة تمامًا لـ `01-BACKEND-CONNECTIVITY.md` (أخبار/ريلز/فيديو):

| الحالة (Backend) | النص المعروض | اللون |
|---|---|---|
| `draft` | مسودة | رمادي محايد (`muted`) |
| `submitted` | مُرسَل | `info` |
| `in_review` | قيد المراجعة | `warning` |
| `scheduled` | مجدوَل | `info` |
| `published` | منشور | `success` |
| `rejected` | مرفوض | `destructive` |
| `archived` | مؤرشف | رمادي محايد (`muted`) |

(الجريدة الرقمية — مرحلة ٢ — تستخدم أربع حالات فقط: `draft`/`scheduled`/`published`/`archived`، نفس
جدول الألوان.) يُعرَض هذا كـ `StatusChip` واحد قابل لإعادة الاستخدام (Radius `sm`، §١٣) يأخذ القيمة
الخام من الباك إند مباشرة — **لا Enum Flutter منفصل يُعاد تعريفه ويُزامَن يدويًا مع الباك إند**؛ خريطة
نص/لون واحدة بسيطة تُقرأ بمفتاح الـ String القادم من الـ API مباشرة.

## ١٤) الشارات (Badges)

عداد رقمي دائري (Radius `full`) بخلفية `destructive` أو `primary` — يُستخدَم فوق أيقونة قسم في التنقّل
الرئيسي لعرض عدد "بانتظار إجراء" (يُغذَّى من نفس بيانات Dashboard، لا نداء API منفصل — راجع
[`../requirements/05-UX-SCREENS-AND-SETTINGS.md`](../requirements/05-UX-SCREENS-AND-SETTINGS.md) §٢).

## ١٥) شريط التطبيق العلوي (App Bar)

بسيط ومسطَّح (`elevation: 0`، خلفية = خلفية الشاشة نفسها، لا لون مغاير) — يطابق الفلسفة العامة "أداة
سريعة" لا "لوحة تحكم ثقيلة". عنوان الشاشة بـ `titleLarge`. **زر رجوع تلقائي RTL-صحيح** (Flutter يعكسه
تلقائيًا عبر `Directionality`، لا كود يدوي).

## ١٦) شريط/نمط التنقّل الرئيسي — ⚠ مواصفات جاهزة لكلا الاحتمالين، القرار نفسه لم يُحسم

مطابقةً لـ [`01-NAVIGATION-AND-STATE.md`](01-NAVIGATION-AND-STATE.md) §١: **نمط التنقّل نفسه (Bottom
Nav أم Drawer) قرار مفتوح عمدًا لم يُحسَم بعد.** القيم أدناه جاهزة لأيهما دون تفضيل مسبق:
- لو **Bottom Navigation Bar**: خلفية `card`، أيقونة/تسمية للعنصر النشط بلون `primary`، غير النشط
  بلون `muted-foreground`، بلا ظل علوي (يُفصَل بخط `border` رفيع فقط — ينسجم مع فلسفة الظل الناعم).
- لو **Drawer**: خلفية `background`، عنصر نشط بخلفية `accent` خفيفة + نص `accent-foreground`.

## ١٧) الزر العائم (FAB)

دائري بالكامل (Radius `full`)، خلفية `primary`. يظهر **فقط** في شاشات القوائم (أخبار/ريلز/فيديوهات)
كاختصار "إنشاء جديد" — **مشروط بالصلاحية** (`hasPermission(ref, 'articles.create')` مثلاً؛ يختفي
تمامًا لا يُعطَّل فقط، لو لم تتوفر الصلاحية — ADR-004).
