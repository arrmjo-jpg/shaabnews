# Architecture — مسار رفع الوسائط (Media Upload Pipeline)

مرجع: [`../requirements/02-MEDIA-AND-CONNECTIVITY.md`](../requirements/02-MEDIA-AND-CONNECTIVITY.md)
(وُصفت بـ"أهم جزء في التطبيق") و[`../01-BACKEND-CONNECTIVITY.md`](../01-BACKEND-CONNECTIVITY.md) §٣.

---

## ١) المراحل الست — بالترتيب، لكل ملف

```
١. الالتقاط        image_picker (كاميرا/معرض، صورة واحدة أو متعددة، أو فيديو)
٢. فحص الصيغة       هل الصيغة مقبولة من الباك إند؟ (jpeg/png/webp للصور، mp4/webm للفيديو)
٣. التحويل          إن لزم: HEIC→JPEG (flutter_image_compress) — فيديو: مؤجَّل بعد Spike (راجع §٤)
٤. الضغط الذكي       تكيّفي حسب نوع الملف وسرعة الشبكة (connectivity_plus) — ليس ضغطًا إجباريًا دائمًا
٥. الرفع            dio FormData + onSendProgress، خلفي غير حاجب للواجهة
٦. الربط            استلام media_asset_id → تمريره عند حفظ الخبر/الريل/الفيديو
```

**قاعدة معمارية أساسية:** المراحل ٢-٤ تحدث **على الجهاز بالكامل قبل أي اتصال شبكة** — الباك إند لا
يُعدَّل ولا يعرف شيئًا عن HEIC أو MOV إطلاقًا (قرار معتمَد في `02-MEDIA-AND-CONNECTIVITY.md` §٢).

## ٢) العقد (Interface) — معزول عن أي حزمة بعينها

```dart
abstract class MediaUploader {
  /// يبث تحديثات التقدّم حتى الانتهاء أو الفشل. لا يُعيد المحاولة تلقائيًا (راجع §٣).
  Stream<UploadProgress> upload(PreparedMediaFile file, {String? profile});
}

sealed class UploadProgress {}
final class UploadInProgress extends UploadProgress { final double percent; ... }
final class UploadSucceeded extends UploadProgress { final int mediaAssetId; final String uuid; ... }
final class UploadFailed extends UploadProgress { final ApiFailure failure; ... }
```

**لماذا عقد منفصل لا استدعاء `dio` مباشر من كل ميزة؟** لأن مرحلة تحويل الفيديو (§٤) **غير محسومة
بعد** — عزل الرفع خلف `MediaUploader` يعني أن استبدال التنفيذ الداخلي لاحقًا (لإضافة تحويل الفيديو
الحقيقي) **لا يمسّ أي كود في `features/articles`/`reels`/`videos`** — كلها تتحدث مع نفس العقد الثابت.

## ٣) قائمة انتظار الرفع (Upload Queue) — رفع خلفي غير حاجب

```dart
class UploadQueueNotifier extends Notifier<Map<String, UploadProgress>> {
  // مفتاح كل رفع = معرّف محلي (uuid) يُنشأ عند بدء الاختيار، قبل أي اتصال شبكة
  Future<void> enqueue(PreparedMediaFile file) async {
    final id = file.localId;
    state = {...state, id: const UploadInProgress(0)};
    await for (final progress in ref.read(mediaUploaderProvider).upload(file)) {
      state = {...state, id: progress};
    }
  }
}
```

أي شاشة (قائمة الأخبار، شاشة إنشاء ريل، الصفحة الرئيسية) يمكنها مراقبة أي رفع جارٍ عبر
`ref.watch(uploadQueueProvider)` بغض النظر عن الشاشة التي بدأته — يحقق متطلب
"إمكانية الانتقال بين الشاشات أثناء الرفع" (`02-MEDIA-AND-CONNECTIVITY.md` §٤) مباشرة.

**خارج نطاق V1 صراحة (بحسب نفس المتطلب):** استئناف الرفع بعد إغلاق التطبيق بالكامل أو إعادة تشغيل
الجهاز — `UploadQueueNotifier` حالة في الذاكرة فقط، **لا** تُخزَّن قائمة الانتظار في تخزين دائم في V1.
لا حزمة رفع خلفي على مستوى النظام (`flutter_uploader`/`background_downloader`) — قرار معتمَد في
Package Baseline.

## ٤) الصور مقابل الفيديو — وضعان مختلفان تمامًا

### الصور — مسار محسوم بالكامل
`flutter_image_compress` (Required) ينفّذ HEIC→JPEG + ضغطًا تكيّفيًا في خطوة واحدة، أصليًا (Kotlin/
Swift) — لا قرار معلَّق هنا.

### الفيديو — ⚠ العقد جاهز، **التنفيذ غير مقرَّر عمدًا**
كما وثّق Package Baseline بالتفصيل: لا حزمة مُلتزَم بها للتحويل/الضغط. `MediaUploader` أعلاه **يفترض**
أن الملف القادم إليه (`PreparedMediaFile`) **مطابق بالفعل** لصيغة الباك إند المقبولة (mp4/webm) — أي
منطق التحويل يعيش خلف واجهة منفصلة تمامًا:

```dart
abstract class VideoPreparer {
  Future<PreparedMediaFile> prepare(XFile rawVideo);
}
```

**عند تنفيذ الـ Spike التقني الموصى به في Package Baseline** (تحديد: هل يكفي Remux خفيف، أم Transcode
كامل عبر `ffmpeg_kit_flutter_new`؟)، **التنفيذ الملموس لـ `VideoPreparer` هو كل ما يتغيّر** — لا شيء
آخر في هذا المسار (الـ Queue، الـ Repository، الشاشات) يُعاد تصميمه. هذا بالضبط سبب وجود هذا العقد.

## ٥) الربط بالمحتوى — لا رفع مضمَّن داخل إنشاء الخبر/الريل

مطابقة صارمة لما وثَّقه `../01-BACKEND-CONNECTIVITY.md` §٢.٢: الريلز والفيديو **لا يقبلان رفع ملف
مباشر عند الإنشاء** — فقط `media_asset_id` جاهز مسبقًا. لذلك تدفّق شاشة "ريل جديد":

```
١. المستخدم يختار/يصوّر فيديو
٢. enqueue() فورًا (الرفع يبدأ في الخلفية بينما المستخدم يكتب العنوان/الوصف)
٣. المستخدم يضغط "حفظ"
٤. الشاشة تنتظر UploadSucceeded (أو تعرض "الرفع لا يزال جاريًا، انتظر" لو لم يكتمل بعد)
٥. ReelRepository.create(payload.copyWith(mediaAssetId: uploadResult.mediaAssetId))
```

**استثناء الفيديوهات فقط:** `source_url` (رابط خارجي YouTube/Vimeo/MP4 مباشر) **لا يمر بهذا المسار
إطلاقًا** — لا رفع، لا `MediaUploader`، حقل نص عادي يُرسَل مباشرة (`../01-BACKEND-CONNECTIVITY.md`
§٢.٣). هذا المسار الأخف يستحق أولوية أعلى في الترتيب الفعلي للتنفيذ (لا رفع ثقيل = مخاطرة أقل لأول
تكرار عملي، كما ورد في `../04-ROADMAP.md` المرحلة ١).

## ٦) إعادة المحاولة عند فشل الرفع — يدوية دائمًا

مطابقة لجدول `RetryInterceptor` في
[`02-API-LAYER-AND-ERROR-HANDLING.md`](02-API-LAYER-AND-ERROR-HANDLING.md) §٣: طلبات الرفع تحمل
`isUpload: true` فتُستثنى من أي إعادة محاولة تلقائية صامتة. عند `UploadFailed`، الواجهة تعرض زر
"إعادة المحاولة" صريحًا — **قرار المستخدم دائمًا لملفات الرفع تحديدًا**، لا قرار تلقائي خلف الكواليس
(خطر تكرار/تلف ملفات كبيرة جزئيًا).
