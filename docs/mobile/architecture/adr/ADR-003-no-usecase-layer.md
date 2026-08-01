# ADR-003: بلا طبقة UseCase منفصلة

## القرار
الـ Controller (Riverpod Notifier) يستدعي الـ Repository **مباشرة**. لا طبقة UseCase/Interactor
وسيطة بين الاثنين في V1.

## السبب
طبقة UseCase تُبرَّر عندما يوجد منطق أعمال حقيقي يستحق عزلاً واختبارًا مستقلاً عن الواجهة. في هذا
التطبيق، منطق الأعمال بالكامل يعيش في الـ Backend (ADR-005) — الـ Repository هنا مجرد نداء API +
تحويل JSON، لا يتخذ قرار عمل واحد. طبقة UseCase فوقه تعني كتابة صفٍّ لكل عملية لا يحتوي أكثر من
`return repository.getArticles();` — ceremony بلا عائد حقيقي.

## البدائل المرفوضة
- **Clean Architecture الكاملة** (`UI → Controller → UseCase → Repository → DataSource`) — نمط شائع
  جدًا في مشاريع Flutter التعليمية، لكن كل طبقة إضافية بلا منطق حقيقي فيها تكلفة صيانة صرفة، غير
  مبرَّرة لفريق صغير/مطوّر واحد.

## الأثر
تقليل ملموس في عدد الملفات/الصفوف لكل عملية. **الاستثناء الوحيد المقبول:** تنسيق واجهة معقّد يجمع أكثر
من نداء Repository (مثال: رفع وسائط قبل إنشاء سجل ريل) يبقى داخل الـ Controller نفسه في V1؛ يُستخرَج
لصف Orchestrator منفصل فقط لو تكرر نفس التنسيق عبر أكثر من شاشة (قاعدة "لا تُجرِّد قبل التكرار
الثالث").

## المرجع
[`docs/mobile/architecture/00-PROJECT-STRUCTURE-AND-LAYERS.md`](../00-PROJECT-STRUCTURE-AND-LAYERS.md) §٢
