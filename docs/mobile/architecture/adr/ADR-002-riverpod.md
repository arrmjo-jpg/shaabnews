# ADR-002: Riverpod كنظام موحّد لإدارة الحالة وحقن الاعتماديات

## القرار
`flutter_riverpod` (بصيغته اليدوية، بلا `riverpod_generator`/Code Generation — راجع ADR-006) هو
النظام الوحيد لإدارة الحالة **و**حقن الاعتماديات معًا. لا حزمة DI منفصلة (`get_it`).

## السبب
تطبيق قائم بالكامل على بيانات غير متزامنة من API (Article/Reel/Video/Media states)، مع حاجة حقن
اعتماديات حقيقية عبر الطبقات (Repository ← Notifier ← UI). Riverpod يوحّد الاثنين في نظام واحد —
شجرة الـ Providers نفسها هي حاوية الحقن، فلا حاجة لنظامين متوازيين.

## البدائل المرفوضة
- **`flutter_bloc`** — انضباط ممتاز لفرق كبيرة، لكن boilerplate أثقل غير مبرَّر لمطوّر واحد/فريق صغير.
- **`provider`** — سلف Riverpod من نفس المطوّر؛ لا مبرر لاختيار السلف على الخلف الرسمي في مشروع جديد.
- **`GetX`** — تدمج State + DI + Routing + HTTP Client في حزمة "شمولية" واحدة، يتعارض مع الفصل
  المتعمَّد بين هذه الطبقات في هذا المشروع (ADR-001). مخاوف مجتمعية موثَّقة: تنقّل بلا `BuildContext`
  (`Get.to()`) يسبب أخطاء دقيقة صعبة التتبّع، ميل لحالة عامة (Global State) يضعف قابلية الاختبار.

## الأثر
كل حالة شاشة = Provider واحد قابل للاختبار عبر `ProviderScope` overrides. لا Service Locator منفصل،
لا حالة عامة متغيّرة (Static/Singleton) خارج شجرة Riverpod تحت أي ظرف.

## المرجع
[`docs/mobile/requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md`](../../requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md) §١ ·
[`docs/mobile/architecture/01-NAVIGATION-AND-STATE.md`](../01-NAVIGATION-AND-STATE.md) §٢
