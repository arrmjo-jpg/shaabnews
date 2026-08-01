# Architecture — طبقة الـ API ومعالجة الأخطاء

مرجع: [`../01-BACKEND-CONNECTIVITY.md`](../01-BACKEND-CONNECTIVITY.md) (شكل الـ API الفعلي) و
[`../requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md`](../requirements/08-PACKAGE-ARCHITECTURE-AUDIT.md)
(قرارات الحزم: `dio`، بلا `dio_smart_retry`، Result Pattern بلا حزمة).

---

## ١) عميل `dio` — إعداد واحد مركزي (`core/network/`)

```dart
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,       // ثابت بناء (build-time)، لا تبديل بيئة داخل التطبيق
    headers: {'Accept': 'application/json'},
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
  ));
  dio.interceptors.addAll([
    AuthInterceptor(ref),
    RetryInterceptor(ref),
    if (kDebugMode) DevLoggingInterceptor(),
  ]);
  return dio;
});
```

ترتيب الـ Interceptors **مهم**: `AuthInterceptor` أولاً (يُرفق التوكن قبل أي منطق آخر)، ثم
`RetryInterceptor` (يحتاج معرفة نوع الطلب — Upload أم لا — التي يوفرها الطلب المُرفَق بالفعل بالتوكن).

## ٢) `AuthInterceptor` — إرفاق Bearer Token

```dart
class AuthInterceptor extends Interceptor {
  final Ref ref;
  AuthInterceptor(this.ref);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await ref.read(secureStorageProvider).readToken();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }
}
```

## ٣) `RetryInterceptor` — قواعد الأعمال المعتمَدة (لا حزمة عامة، Package Baseline §Retry)

هذا الجدول **معتمَد حرفيًا** من قرار رفض `dio_smart_retry`:

```dart
class RetryInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final isUpload = err.requestOptions.extra['isUpload'] == true;
    final status = err.response?.statusCode;

    if (isUpload) {
      return handler.next(err); // لا إعادة محاولة تلقائية للرفع أبدًا — قرار المستخدم فقط
    }
    if (status == 401) {
      ref.read(authControllerProvider.notifier).forceLogout(); // لا إعادة محاولة — الجلسة منتهية
      return handler.next(err);
    }
    if (status == 429) {
      await _waitForRetryAfter(err.response?.headers); // Backoff قبل إعادة المحاولة
      return handler.next(await _retry(err.requestOptions));
    }
    if (status == null && err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout) {
      return handler.next(await _retry(err.requestOptions)); // Timeout يُعاد محاولته
    }
    if (status != null && status >= 500) {
      return handler.next(await _retryOnceWithBackoff(err.requestOptions)); // 500 قد يُعاد
    }
    handler.next(err); // كل شيء آخر (400/403/404/422...) يمرّ كما هو — خطأ حقيقي، لا إعادة محاولة
  }
}
```

**علامة `isUpload`** تُمرَّر صراحة عبر `Options(extra: {'isUpload': true})` عند أي طلب `POST
/admin/media` أو رفع Multipart — تفصيل كامل في
[`04-MEDIA-UPLOAD-PIPELINE.md`](04-MEDIA-UPLOAD-PIPELINE.md).

## ٤) نمط النتيجة (`Result<T>`) — Dart 3 sealed classes، بلا حزمة

```dart
sealed class Result<T> {
  const Result();
}

final class Ok<T> extends Result<T> {
  final T value;
  const Ok(this.value);
}

final class Err<T> extends Result<T> {
  final ApiFailure failure;
  const Err(this.failure);
}
```

**قاعدة صارمة:** طبقة الـ Repository **لا ترمي Exceptions** لمسارات الخطأ المتوقَّعة من الـ API (فشل
تحقق، 401، 404، خطأ خادم). فقط أخطاء برمجية حقيقية غير متوقَّعة (Null حيث لا يجب، Bug) تُرمى كـ
Exception عادي وتُترك لـ Crashlytics. هذا يجبر كل نداء Repository على معالجة صريحة لحالة الفشل بدل
`try/catch` متناثر في كل شاشة.

## ٥) `ApiFailure` — يعكس عقد استجابة الباك إند حرفيًا

عقد الباك إند الموحّد (`../01-BACKEND-CONNECTIVITY.md` §٢): `{success:false, message, errors?}`.
التحويل من استجابة HTTP خام إلى `ApiFailure` نوعي يحدث في **مكان واحد فقط** (`core/network/`):

```dart
sealed class ApiFailure {
  final String message;
  const ApiFailure(this.message);
}

final class ValidationFailure extends ApiFailure {
  final Map<String, List<String>> errors; // نفس مفاتيح "errors" من استجابة الباك إند
  const ValidationFailure(super.message, this.errors);
}

final class UnauthorizedFailure extends ApiFailure {
  const UnauthorizedFailure(super.message); // 401 — يُعالَج مركزيًا في RetryInterceptor أيضًا
}

final class ForbiddenFailure extends ApiFailure {
  const ForbiddenFailure(super.message); // 403 — صلاحية ناقصة، ليست جلسة منتهية
}

final class NotFoundFailure extends ApiFailure {
  const NotFoundFailure(super.message); // 404
}

final class ServerFailure extends ApiFailure {
  const ServerFailure(super.message); // 5xx بعد استنفاد إعادة المحاولة
}

final class NetworkFailure extends ApiFailure {
  const NetworkFailure(super.message); // انقطاع اتصال — يُربَط بـ connectivity_plus لعرض بانر مناسب
}
```

**قاعدة تسمية:** كل ملف `*_repository_impl.dart` يحتوي دالة تحويل واحدة `ApiFailure
_mapDioException(DioException e)` — **لا يُكرَّر هذا المنطق** في كل Repository؛ يعيش كدالة مشتركة في
`core/network/api_failure_mapper.dart` وتُستدعى من كل التطبيقات.

## ٦) عرض الأخطاء في الواجهة — مكوّن موحّد، لا تكرار لكل شاشة

`ResultView<T>` (في `core/widgets/`) يأخذ `AsyncValue<T>` + `builder` للحالة الناجحة، ويعرض تلقائيًا:
- `loading` → مؤشر تحميل موحّد.
- `error` → رسالة مطابقة لنوع `ApiFailure` (رسالة تحقق مفصَّلة لـ `ValidationFailure`، "تحقق من
  الاتصال" لـ `NetworkFailure`، رسالة عامة لـ `ServerFailure`) + زر "إعادة المحاولة" يستدعي
  `ref.refresh(...)`.
- `UnauthorizedFailure` **لا تُعرَض كخطأ شاشة عادي** — `AuthInterceptor`/`authControllerProvider` يتولى
  التوجيه لشاشة الدخول تلقائيًا قبل أن تصل الشاشة لعرض أي شيء (راجع
  [`03-AUTHENTICATION-FLOW.md`](03-AUTHENTICATION-FLOW.md)).

هذا يمنع تكرار "if error show X" في كل شاشة من شاشات التطبيق — نفس مبدأ "الحد من الازدواجية" الذي
حكم كل قرارات الحزم.
