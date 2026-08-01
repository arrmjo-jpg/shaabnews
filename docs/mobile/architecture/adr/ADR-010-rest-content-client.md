# ADR-010: استخراج `RestContentClient<T>` بعد التكرار الثالث الحقيقي

## القرار
`core/content/rest_content_client.dart` يوفّر محرّكًا عامًا (`RestContentClient<T>`) لعمليات
`list/show/create/update/transitionStatus` الميكانيكية (Dio + try/catch + فكّ JSON) — يُستهلَك من
`ArticleRepositoryImpl`, `ReelRepositoryImpl`, `VideoRepositoryImpl` بدل تكرار نفس الكود ثلاث مرات.
**عقود الميزات (`ArticleRepository`, `ReelRepository`, `VideoRepository`) تبقى منفصلة ومكتوبة يدويًا**
— المحرّك ينفّذها فقط، لا يعرف شيئًا عن شكل حمولة أي ميزة (Article لديه `content_json` مثلاً، Reel/
Video لا).

## السبب
قاعدة "لا تُجرَّد قبل التكرار الثالث" (Rule of Three) المعتمَدة صراحة من صاحب المنتج
(`docs/mobile/requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md`، فلسفة "لا Code Generation مبكر" الأوسع).
عند بدء Sprint 5 (Videos)، أصبح النمط مكررًا **فعليًا وليس افتراضيًا** في ثلاث ميزات — هذه هي اللحظة
التي حدّدها صاحب المنتج بنفسه لإعادة النظر، لا قبلها.

## البدائل المرفوضة
- **عدم الاستخراج إطلاقًا** — يعني تكرار حرفي لنفس ~40 سطرًا (Dio calls + try/catch + فكّ JSON) في
  ملف Repository رابع (Videos) وخامس محتمل (Epaper لاحقًا) — دَين تقني حقيقي مؤجَّل بلا مبرر بعد
  ثبوت التكرار.
- **استخراج Controllers أيضًا عبر Riverpod Generics** (`ContentListController<T>` إلخ) — خيار مطروح
  وتم رفضه بقرار صاحب المنتج: تعقيد أكبر في نظام الأنواع (Riverpod Generics + Family Providers) مقابل
  عائد أقل (كل Controller ~20-30 سطرًا بسيطًا فقط) — لا يستحق التضحية بالوضوح المباشر لكل ميزة على
  حدة، خصوصًا لمشروع بمطوّر واحد/فريق صغير.

## الأثر
- إضافة نوع محتوى رابع (الجريدة الرقمية، Sprint 6) تعني كتابة الفروق الحقيقية فقط (شكل الحمولة، شاشات
  العرض) — لا إعادة كتابة منطق REST الميكانيكي.
- أي تصحيح مستقبلي في معالجة الأخطاء أو شكل الاستجابة يُصلَح في مكان واحد (`RestContentClient`) وينعكس
  تلقائيًا على كل الميزات الثلاث.
- **لم تُمسّ** طبقات الـ Controllers أو الشاشات إطلاقًا في هذا الاستخراج — بقيت كما هي في كل ميزة،
  بقرار صريح.

## المرجع
[`docs/mobile/architecture/00-PROJECT-STRUCTURE-AND-LAYERS.md`](../00-PROJECT-STRUCTURE-AND-LAYERS.md) §٣ ·
[`docs/mobile/requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md`](../../requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md)
