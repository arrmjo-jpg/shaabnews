# إمكانية الربط مع الـ Backend — توثيق فعليّ (لا كود مقترح)

كل ما في هذا المستند موجود **فعلياً** في الكود الحالي (`F:\website\shaabjo`) اليوم — تم التحقق منه
مباشرة من المسارات (`routes/api.php`, `routes/api/v1/admin*.php`) والـ Controllers/Actions/Requests
المقابلة. لا شيء هنا افتراضي أو "سيُبنى لاحقاً" إلا ما وُسم صراحة كذلك. القاعدة: `Base URL = /api/v1`.

---

## ١) المصادقة (Authentication)

### الخلاصة
يوجد بالفعل **مصادقة Bearer Token خالصة عبر Laravel Sanctum** (Personal Access Tokens)، منفصلة تماماً
عن آلية الكوكيز/CSRF الخاصة بـ SPA على المتصفح. تطبيق الموبايل **لا يحتاج أي تعديل على الـ backend**
ليستخدم هذه الآلية — نفس ما يستخدمه `admin-frontend` (React) اليوم.

### تسجيل الدخول
```
POST /api/v1/admin/auth/login
Body: { email, password, recaptcha_token? }
```
- Middleware: `throttle:admin.login` + `recaptcha:admin_login` (انظر §٣ في
  [`03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md`](03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md) بخصوص أثر
  reCAPTCHA v3 على عميل موبايل).
- منطق الرفض (بترتيب الفحص، `AdminLoginAction`):
  1. بريد/كلمة مرور غير صحيحين → رسالة خطأ موحّدة (لا تكشف وجود الحساب من عدمه).
  2. حساب `suspended` أو `banned` → `403`.
  3. **الدور ليس ضمن الأدوار الإدارية السبعة** → يُرفض بنفس رسالة الخطأ الموحّدة (حساب قارئ عادي
     لا يستطيع الدخول لتطبيق الإدارة إطلاقاً، حتى لو كانت كلمة المرور صحيحة).
  4. `email_verified_at` فارغ → `403` مع `code: email_unverified`.
- عند النجاح: يُسجَّل نشاط دخول (Audit)، ويُصدَر توكن:
  `$user->createToken('admin-token', ['admin'])->plainTextToken`
  — أي أن كل توكن إداري يحمل **ability واحدة اسمها `admin`** (تُفحص لاحقاً في كل طلب — انظر أدناه).
- الاستجابة: `{ success, message, data: { token, user: { id, name, email, status, roles[] } } }`.

### انتهاء صلاحية التوكن
`config/sanctum.php` → `expiration = env('SANCTUM_TOKEN_EXPIRATION', 60*24*7)` — **7 أيام افتراضياً**.
يوجد أمر مجدول `sanctum:prune-expired` يُنظّف التوكنات المنتهية. **التطبيق يجب أن يتعامل مع 401 كإشارة
لإعادة تسجيل الدخول — لا يوجد Refresh Token منفصل، فقط توكن واحد طويل الأمد.**

### باقي مسارات الدخول (guest، بلا توكن)
| Method | URI | الوصف |
|---|---|---|
| POST | `/admin/auth/forgot-password` | إرسال رابط إعادة تعيين (throttle + recaptcha) |
| POST | `/admin/auth/reset-password` | إعادة تعيين كلمة المرور (throttle + recaptcha) |
| POST | `/admin/auth/email/resend` | إعادة إرسال رابط تحقّق البريد |
| GET | `/admin/auth/email/verify/{id}/{hash}` | رابط تحقّق موقَّع (signed URL) — **مصمَّم كرابط بريد
  إلكتروني يُفتح في متصفح، وليس نداء API نقياً**؛ يحتاج قراراً في التصميم (فتح Deep Link / WebView؟). |

### مسارات محمية بعد الدخول (`auth:sanctum`)
| Method | URI | الوصف |
|---|---|---|
| GET | `/admin/auth/me` | بيانات المستخدم الحالي + الأدوار + **الصلاحيات الفعلية** — يُستدعى عند
  فتح التطبيق لتحديد ما يظهر/يُخفى من واجهات (انظر §٤ في [`00-OVERVIEW.md`](00-OVERVIEW.md)) |
| POST | `/admin/auth/logout` | يُبطل التوكن الحالي فقط (لا يمس أجهزة أخرى) |

### إدارة الجلسات عبر الأجهزة — **جاهزة بنيوياً لدعم "دخول من الموبايل + الويب معاً"**
| Method | URI | الوصف |
|---|---|---|
| GET | `/admin/profile/sessions` | قائمة كل التوكنات النشطة (كل جهاز/متصفح = صف مستقل) |
| DELETE | `/admin/profile/sessions/{id}` | إبطال جلسة/جهاز محدد عن بُعد |
| POST | `/admin/profile/sessions/revoke-others` | إبطال كل الجلسات الأخرى عدا الحالية |

هذا يعني: مستخدم يُسجّل دخوله من `admin-frontend` على المتصفح **وأيضاً** من تطبيق الموبايل في نفس
الوقت دون تعارض — وكلاهما يظهر كصفّين منفصلين قابلين للإبطال الفردي من أي منهما. **لا حاجة لأي عمل
backend إضافي لدعم هذا السيناريو.**

### بوّابة الحماية الكاملة لكل `/admin/*` (بعد الدخول)
```php
Route::prefix('admin')->middleware([
    'auth:sanctum',        // توكن Bearer صالح
    'abilities:admin',     // التوكن يحمل ability = 'admin' (توكنات القرّاء لا تملكها)
    'active',               // الحساب غير موقوف
    'role:super_admin|editor|reviewer|moderator|social_media_manager|journalist|contributor',
])
```
أي نداء API إداري من التطبيق يمر بهذه الطبقات الأربع تلقائياً؛ التطبيق فقط يحتاج إرسال
`Authorization: Bearer <token>` + `Accept: application/json` في كل طلب.

### ما لا يوجد
- **لا مصادقة ثنائية العامل (2FA/OTP) من أي نوع.** بحث شامل في الكود لم يُرجع أي أثر لها.
- **لا Refresh Token** — توكن واحد طويل الأمد (7 أيام) لكل جلسة/جهاز.

---

## ٢) نقاط النهاية حسب المورد (Resource Endpoints)

عقد الاستجابة الموحّد لكل نداء (`App\Support\Responses\ApiResponse`، مصدر وحيد لكل الـ backend):
```jsonc
// نجاح
{ "success": true,  "message": "...", "data": { /* مورد أو قائمة */ }, "meta": { /* ترقيم صفحات إلخ */ } }
// خطأ
{ "success": false, "message": "...", "errors": { /* تفاصيل validation إن وُجدت */ } }
```

### ٢.١ الأخبار — Articles (`/admin/articles`)

نموذج واحد (`type`: `news` | `opinion` | `live`) بحالات سير عمل موحّدة:
`draft → submitted → in_review → scheduled → published → rejected/archived`.

| Method | URI | الوظيفة |
|---|---|---|
| GET | `/articles` | قائمة (فلاتر: `status`, `type`, `locale`, `category`, `author_id`, `placement`, `search`, ترقيم صفحات) |
| POST | `/articles` | إنشاء |
| GET | `/articles/stats` | عدّادات بطاقات (منشور/مسودة/محذوف/مميّز) |
| GET | `/articles/analytics` | تحليلات أسطول المقالات |
| GET | `/articles/slug-check` | فحص توفّر slug |
| POST | `/articles/embeds/resolve` | تحليل رابط تضمين (allow-list) |
| POST | `/articles/clear-breaking` / `/clear-pinned` | إلغاء جماعي لعلم عاجل/مثبّت |
| GET | `/articles/{id}` | تفصيل |
| GET | `/articles/{id}/preview` | معاينة الحمولة العامة + إرشاد SEO |
| GET | `/articles/{id}/analytics` | تحليلات مقال واحد (نطاق زمني) |
| PUT | `/articles/{id}` | تعديل |
| **PATCH** | **`/articles/{id}/status`** | **انتقال حالة سير العمل** (نشر/جدولة/رفض/أرشفة) — محكوم
  بـ `ArticleWorkflowGuard`؛ من يستطيع فعل أي انتقال يعتمد على صلاحياته الفعلية |
| GET/POST/PUT/PATCH/DELETE | `/articles/{id}/media/*` | رفع/قائمة/إعادة ترتيب/حذف وسائط المقال |
| GET/POST/PUT/PATCH/DELETE | `/articles/{id}/live-updates/*` | خط زمني للتغطية الحية (فقط لمقالات `type=live`) |
| DELETE / POST restore / DELETE force | `/articles/{id}` | حذف ناعم / استرجاع / حذف نهائي |

**شكل بيانات المقال** (`ArticleData` — مطابق تماماً لـ `ArticleResource` في الـ backend):
`id, type, status, locale, title, subtitle, slug, excerpt, content_json, content_html, tags[], seo{},
is_featured/is_breaking/is_pinned/is_header/is_editor_pick/is_squares, event_status, published_at,
views_count, metrics{views,likes,dislikes,favorites}, author{id,name,avatar}, primary_category{},
secondary_categories[], media{cover,gallery[],inline[],video[]}`.

### ٢.٢ الريلز — Reels (`/admin/reels`)

نوع محتوى مستقل من الدرجة الأولى (ليس مقالاً بنوع خاص). نفس حالات سير العمل السبع.

| Method | URI | الوظيفة |
|---|---|---|
| GET | `/reels` | قائمة (فلاتر: `status`, `locale`, `search`, ترقيم) |
| GET | `/reels/stats` / `/reels/analytics` | عدّادات / تحليلات أسطول |
| POST | `/reels` | إنشاء |
| GET | `/reels/{id}` / `/{id}/analytics` | تفصيل / تحليلات سياقية |
| PUT | `/reels/{id}` | تعديل |
| PATCH | `/reels/{id}/status` | انتقال حالة |
| DELETE / restore / force | `/reels/{id}` | حذف ناعم / استرجاع / نهائي |

**مهم لتصميم شاشة "إضافة ريل":** الفيديو **لا يُرفع مباشرة عند الإنشاء** — الحقل `media_asset_id`
فقط، ويُفترض أن الفيديو رُفع مسبقاً عبر نقطة الوسائط المركزية (§٤ أدناه) وحصل على معرّف. تدفّق
الشاشة الصحيح: رفع الفيديو أولاً → انتظار/عرض حالة المعالجة → إنشاء الريل بربط المعرّف الناتج.

**شكل بيانات الريل**: `id, uuid, status, is_featured, locale, title, slug, description,
duration_seconds, seo{}, share_image, metrics{}, media_asset_id, media{id,uuid,processing_status},
author{id,name}, published_at`.

### ٢.٣ الفيديوهات — Videos (`/admin/videos`, `/admin/video-categories`, `/admin/video-playlists`)

نطاق أوسع من الريلز: تصنيفات شجرية خاصة بالفيديو + قوائم تشغيل، ولوحة تحكم مخصّصة.

| Method | URI | الوظيفة |
|---|---|---|
| GET | `/videos` | قائمة (فلاتر: `status`, `visibility`, `source_type`, `video_category_id`, `search`) |
| GET | `/videos/stats` / `/dashboard` / `/analytics` / `/operations` | عدّادات / لوحة قيادة (**مصمَّمة
  أصلاً لتُستهلك من الواجهة/الموبايل**، انظر تعليق الكود عند هذا المسار) / تحليلات / رؤية تشغيلية
  (فيديوهات تعثّرت معالجتها، طابور نشر مجدوَل متأخّر) |
| POST | `/videos/bulk` | عملية جماعية (نشر/إلغاء نشر/تمييز/نقل تصنيف/إضافة لقائمة/حذف) |
| POST | `/videos` | إنشاء |
| GET | `/videos/{id}` / `/{id}/analytics` | تفصيل / تحليلات سياقية |
| PUT | `/videos/{id}` | تعديل |
| PATCH | `/videos/{id}/status` | انتقال حالة |
| POST | `/videos/{id}/reprocess` | إعادة محاولة معالجة فيديو فشلت معالجته |
| DELETE / restore / force | `/videos/{id}` | حذف ناعم / استرجاع / نهائي |

**مصدر الفيديو مرن** (`source_type`): `uploaded` (عبر `media_asset_id` مرفوع مسبقاً) أو `youtube` /
`vimeo` / `direct_mp4` (عبر `source_url` رابط خارجي مباشر — **لا رفع ملف مطلوب أبداً في هذه الحالة**،
مناسب جداً لسيناريو موبايل بلا رفع ثقيل). يمكن أيضاً إنشاء مسودة بلا مصدر وربطه لاحقاً؛ النشر يُمنع
بدون مصدر صالح.

**تصنيفات الفيديو والقوائم** (`video-categories/*`, `video-playlists/*`): CRUD كامل + إعادة ترتيب
(`move`/`reorder`) + إسناد/فصل فيديوهات من قائمة تشغيل. تفصيلها اختياري لموبايل — الأولوية لشاشات
الفيديو الأساسية.

### ٢.٤ الجريدة الرقمية — Epaper (`/admin/epapers`)

**قيد تشغيلي مهم:** كل مسارات الجريدة (عدا `/epapers/settings`) محجوبة بـ 404 إن كانت الوحدة معطَّلة
من الإعدادات (`newspaper.enabled` middleware — دلالة "معطَّل = غير موجود"). التطبيق يجب أن يستدعي
`GET /admin/epapers/settings` أولاً (متاح لأي إداري مصادَق بلا صلاحية خاصة) ليقرر إظهار قسم الجريدة
من عدمه.

حالات أبسط من بقية الأنواع (لا `submitted/in_review/rejected`): `draft → scheduled → published → archived`.

| Method | URI | الوظيفة |
|---|---|---|
| GET | `/epapers/settings` | تفعيل الوحدة + الاسم المعروض |
| GET | `/epapers` | قائمة أعداد |
| POST | `/epapers` | **إنشاء عدد جديد — multipart إلزامي** (انظر أدناه) |
| GET | `/epapers/analytics` / `/operations` | لوحة تحليلات القارئ العابرة للأعداد / رؤية تشغيلية |
| GET | `/epapers/{id}` / `/{id}/analytics` | تفصيل / تحليلات قارئ لعدد واحد |
| PUT | `/epapers/{id}` | تعديل بيانات وصفية (لا يستبدل الملف) |
| POST | `/epapers/{id}/replace-pdf` | استبدال ملف PDF (نسخة/إصدار جديد) |
| POST | `/epapers/{id}/cover` | تعيين غلاف يدوياً (صورة) — بديل عن التوليد التلقائي |
| POST | `/epapers/{id}/ocr/rerun` | إعادة تشغيل استخراج النص (**معطَّل بقرار منتج حالياً** — انظر §٣) |
| PATCH | `/epapers/{id}/status` | انتقال حالة |
| POST | `/epapers/{id}/duplicate` | تكرار عدد كقالب لعدد جديد |
| DELETE / restore / force | `/epapers/{id}` | حذف ناعم / استرجاع / نهائي |

**إنشاء عدد (`POST /epapers`, multipart/form-data)**:
- `issue_number` (رقم، إلزامي)، `title` (إلزامي، ≤190 حرفاً)، `publication_date` (إلزامي)،
  `locale` (`ar`/`en`)، `access_level` (`public`/`subscriber`/`private`).
- حقول تحريرية اختيارية منظَّمة: `brief_points[]` (نقاط موجزة)، `highlights[]` (أبرز الاقتباسات)،
  `inside_this_issue[]` (فهرس داخل العدد) — كل عنصر كائن صغير (title/why أو title/quote/page إلخ).
- **`file`** إلزامي — `mimetypes:application/pdf`، **الحد الأقصى ~100 ميجابايت افتراضياً**
  (`config('performance.media.pdf_max_kb', 102400)`). انظر §٢ من
  [`03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md`](03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md) لأثر هذا على
  تجربة الرفع من شبكة موبايل.
- عند الإنشاء: يُخزَّن الـ PDF عبر نظام الوسائط المركزي، تُنشأ أول نسخة (`EpaperVersion`)، ويُجدوَل
  توليد غلاف تلقائي من الصفحة الأولى في الخلفية (Job منفصل، لا ينتظره الطلب).
- **ملاحظة صريحة من الكود:** استخراج النص/OCR معطَّل عمداً — "القارئ للعرض والتنزيل فقط، لا بحث
  داخل النص ولا فهرسة" — رغم وجود مسار `ocr/rerun`، الحقول `text_layer`/`ocr_status`/`page_count`
  تبقى فارغة حالياً بقرار منتج، ليست عيباً تقنياً.

**غلاف يدوي** (`POST /{id}/cover`, multipart): `mimetypes:image/jpeg,image/png,image/webp`،
حد أقصى ~5 ميجابايت (`config('performance.media.image_max_kb', 5120)`).

---

## ٣) الوسائط والرفع (Media Upload) — نقطة نهاية عامة قابلة للاستخدام مباشرة

**النمط الفعلي:** المحتوى التحريري (صور/فيديوهات مقالات، فيديوهات الريلز/المكتبة) **لا يمر عبر
Spatie MediaLibrary** (تلك مستخدمة فقط لصور المستخدمين الشخصية). يمر عبر نظام مخصّص بالمشروع اسمه
"Media Asset"، عبر نقطة نهاية عامة واحدة يمكن لتطبيق الموبايل استخدامها مباشرة **دون أي تعديل**:

| Method | URI | الوظيفة |
|---|---|---|
| GET | `/admin/media` | قائمة أصول الوسائط |
| **POST** | **`/admin/media`** | **رفع ملف (multipart، حقل `file` + `profile` اختياري)** — يعيد `media_asset_id`/`uuid` يُستخدم لاحقاً عند إنشاء/تحديث مقال أو ريل أو فيديو |
| POST | `/admin/media/external/resolve` | معاينة رابط فيديو خارجي (YouTube إلخ) قبل الحفظ |
| POST | `/admin/media/external` | تسجيل فيديو خارجي كأصل مكتبة (بلا رفع ملف) |
| POST | `/admin/media/{id}/reprocess` | إعادة معالجة أصل فشلت معالجته |
| GET | `/admin/media/{id}` | تفصيل الأصل + أين يُستخدَم حالياً (منع حذف أصل مستخدَم بلا `force`) |
| PATCH | `/admin/media/{id}` | تعديل بيانات وصفية (alt/caption/credit) |
| DELETE | `/admin/media/{id}` | حذف (بحارس استخدام) |

**سلوك مهم للتصميم:**
- **Dedupe تلقائي بالـ checksum (SHA-256)** — رفع نفس الملف مرتين لا يُنشئ نسخة مكرَّرة، يُعاد استخدام
  الموجود. لا حاجة لمنطق تكرار على مستوى التطبيق.
- **المعالجة غير متزامنة (queue) بعد الرفع مباشرة**: صورة → توليد مشتقّات WebP؛ فيديو → ترميز
  (transcode). الحقل `processing_status` (`queued → processing → ready/failed`) يُستطلَع عبر
  `GET /media/{id}` — **التطبيق يحتاج شاشة/حالة "جارٍ المعالجة" مع استطلاع دوري (polling)**، خصوصاً
  لفيديوهات الريلز/المكتبة، إذ لا يوجد push/websocket جاهز لإعلام العميل بجهوزية الملف (تفصيل الفجوة
  في §٤ من [`03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md`](03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md)).
- حدود حجم الفيديو من `config/performance.php`: فيديو عام حتى ~250 ميجابايت
  (`MEDIA_VIDEO_MAX_KB`, افتراضي 256000)، فيديو ريل حتى ~150 ميجابايت (`MEDIA_REEL_VIDEO_MAX_KB`,
  افتراضي 153600).

**تدفّق موصى به لأي شاشة "إضافة صورة/فيديو" في الموبايل:** رفع الملف أولاً عبر `POST /admin/media`
والحصول على `media_asset_id` → استطلاع `processing_status` حتى `ready` (للفيديو) → تمرير المعرّف عند
حفظ المقال/الريل/الفيديو. **ملف PDF الجريدة استثناء** — يُرفع مباشرة ضمن `POST /epapers` نفسه، لا عبر
`/media` بشكل منفصل أولاً.

---

## ٤) الإشعارات الفورية (Push) — بنية جاهزة لكن موجَّهة للقرّاء لا للمدراء

توجد بنية تحتية كاملة لتسجيل جهاز موبايل واستقبال Push عبر Firebase Cloud Messaging، **لكنها مبنية
لجمهور الموقع العام (القرّاء)**، وليست موجَّهة أصلاً لتنبيه المدراء داخل تطبيقهم. تفصيل الفجوة والخيارات
في §٥ من [`03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md`](03-TECHNICAL-CONSIDERATIONS-AND-GAPS.md).

نقاط تسجيل الجهاز (عامة، خارج `/admin`، bearer اختياري):
```
POST   /api/v1/devices            { device_id, fcm_token, platform: android|ios|web, locale? }
PATCH  /api/v1/devices/token       { device_id, fcm_token }   // تدوير التوكن
GET    /api/v1/devices/topics
DELETE /api/v1/devices/{deviceId}
```
إن أُرسل توكن Sanctum إداري صالح مع `POST /devices`، يُربط الجهاز بحساب المدير تلقائياً (السيرفر
يقرأ `$request->user('sanctum')?->id`) — تقنياً هذا يعمل اليوم لربط جهاز الموبايل الإداري بحساب
المستخدم، **لكن لا يوجد حالياً أي حدث backend يرسل إشعاراً "لمدير" عبر هذه الآلية** (مركز الإشعارات
الحالي `/admin/notifications/*` يُدير حملات تُرسَل لجمهور القرّاء، وليس تنبيهات داخلية للفريق).

---

## ٥) إصدار الـ API وتوثيقه

- إصدار واحد فقط حالياً: **v1** — لا `v2` ولا خطة إهلاك معلنة.
- `knuckleswtf/scribe` مثبَّت ومُهيَّأ (`config/scribe.php`، يطابق `api/*`) **لكن لا يوجد توثيق
  OpenAPI مُولَّد فعلياً في المستودع بعد** (لا `.scribe/` ولا `public/docs/`). توليده ممكن بأمر
  `php artisan scribe:generate` — مفيد جداً كمرجع تعاقدي حيّ لفريق الموبايل، لكن تنفيذه خارج نطاق هذا
  المستند التخطيطي (لا كود/أوامر تُنفَّذ هنا).

---

## ٦) الأدوار والصلاحيات — كيف يقرأها التطبيق

- `App\Models\User` يستخدم Spatie `laravel-permission` — نظام صلاحيات حبيبي (view/create/edit/
  delete/restore/force_delete/publish/... لكل مورد بشكل منفصل: `articles.*`, `reels.*`, `videos.*`,
  `video-categories.*`, `video-playlists.*`, `epapers.*`, `categories.*`, `media.*`).
- **فقط `super_admin` يملك كل الصلاحيات افتراضياً** (من الـ Seeder). باقي الأدوار الستّة (`editor`,
  `reviewer`, `moderator`, `social_media_manager`, `journalist`, `contributor`) **بلا صلاحيات
  مضمونة سلفاً** — تُهيَّأ يدوياً من واجهة "الأدوار والصلاحيات" في لوحة التحكم، وتختلف فعلياً بين
  تنصيب وآخر.
- **الخلاصة العملية:** لا تُبنى شاشات التطبيق أو منطق الإخفاء/الإظهار بناءً على اسم الدور. القاعدة
  الوحيدة الصحيحة: اقرأ `permissions[]` من استجابة `GET /admin/auth/me` (أو `GET /admin/profile/permissions`)
  وابنِ الواجهة بناءً عليها — تماماً كما يفعل `admin-frontend` اليوم.
