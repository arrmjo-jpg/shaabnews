# مراجعة معمارية تكميلية — واجهة Next.js العامة

**تقرير معماريّ، بلا أي إصلاحات.** يكمّل [FRONTEND-AUDIT.md](FRONTEND-AUDIT.md)
(تقرير المشكلات الفردية) بتحليل بنيويّ عبر 8 محاور: العقد البرمجيّ للـ API،
معماريّة الـ Feed، طبقة BFF، مصفوفة الكاش/ISR، إعادة استخدام المكوّنات، كفاءة
الطلبات، الجاهزية المستقبليّة، والتقييم الإجماليّ مع أولويات مرتّبة حسب العائد
(ROI) لا الخطورة فقط.

**المنهجية**: قراءة مباشرة لكامل طبقة `lib/*.ts` (33 ملفاً يستدعي API)، كل
الـ 30 BFF route handlers، جرد كامل لكل صفحة/layout، مقارنة حقل-بحقل مع
الموارد (Resources) اللارافيلية الفعليّة عبر قراءة الكود المصدري + `git log -p`
حيثما استُشعر تضارب، وجرد كامل لمكوّنات البطاقة/الهيرو/الشريط
الجانبي/الترقيم عبر الشجرة الكاملة. كل ادّعاء مؤيَّد بمسار ملف + رقم سطر.

---

## 1. API Contract Validation

### جدول العقد الكامل

| Endpoint | Laravel Resource | Zod Schema | Mapping Function | React Consumer(s) |
|---|---|---|---|---|
| `GET /{locale}/homepage` | `PublicArticleListItemResource` (عبر `BuildPublicHomepageAction`) | `HomepageEnvelopeSchema` + `ItemSchema` (`feed.ts:69-93,176-184`) | `mapItem` (`feed.ts:112`) | `(site)/page.tsx:46`, `(site)/layout.tsx:24` |
| `GET /{locale}/feed/{kind}` | نفسه | `ItemSchema`/`EnvelopeSchema` | `mapItem` | `getHeroFeed`/`getHeaderFeed`/`getLatestFeed`/`getEditorsPickFeed`/`getBreakingFeed` — مستهلكة في الرئيسية، en/الرئيسية، صفحة المقال، صفحة الكاتب، `/latest` |
| `GET /{locale}/articles` (cursor) | نفسه | `EnvelopeSchema` | `mapItem` | `getCategoryFeed`/`getTagFeed`/`getAuthorArticles` (`feed.ts`) |
| `GET /{locale}/articles` (paginated) | نفسه | `PaginatedEnvelope` (`feed.ts:390-405`) | `mapItem` | `getCategoryPage` (`feed.ts`)، `getWriterArticles` (`writer.ts`)، `searchArticles` (`search.ts`) — **ثلاث دوال منفصلة، منطق شبه مطابق (انظر §2)** |
| `GET /{locale}/articles/{slug}` | `PublicArticleResource` | `ArticleSchema`/`ArticleEnvelope` (`articles.ts:143-196`) | `mapArticle` (`articles.ts:217`) | `article/[id]/page.tsx`، `en/article/[id]/page.tsx` |
| `GET /{locale}/articles/{slug}/live-updates` | `PublicLiveUpdateResource` | `LiveUpdateSchema`/`LiveListEnvelope` | `mapLiveUpdate` | `article/[id]/page.tsx` (فقط عند `type==='live'`) |
| `GET /{locale}/articles/most-read` | `PublicArticleListItemResource` | `EnvelopeSchema` (معاد استخدامه) | `mapItem` | `getMostReadFeed` — الرئيسية، صفحة المقال، en/الرئيسية، **وأيضاً `/trending` (انظر أدناه)** |
| `GET /{locale}/articles/trending` | `PublicArticleListItemResource` (خوارزمية ترجيح مختلفة تماماً) | — | — | **غير مُستخدَم إطلاقاً.** التوثيق الوحيد له تعليق واحد في `feed.ts:232` يشرح لماذا تمّ تفاديه (نافذة 7 أيام قد تُفرغ النتيجة). القرار موثَّق ومقصود، لكن النتيجة العمليّة: خوارزميّة الترجيح الموزون بالكامل (`views×1+likes×4+favorites×6−dislikes×2`) ميتة من منظور الواجهة. |
| `GET /{locale}/articles/breaking` | شكل خاصّ مصغَّر (ليس `PublicArticleListItemResource`) | — | — | **غير مُستخدَم إطلاقاً، بلا أي توثيق حتى.** لا توجد أي إشارة له في كامل شجرة `frontend/src` (تأكّد بالبحث المباشر). الواجهة تستخدم `/feed/breaking` حصرياً لهذا الغرض. |
| `GET /{locale}/categories` | `PublicCategoryResource` (شجرة كاملة، recursive) | `NodeSchema`/`EnvelopeSchema` (`categories.ts:21-33`) **و** بشكل منفصل `fetchCategoryIndex`'s inline schema (`feed.ts:261-289`) | `flatten` (categories.ts) **و** `walk` (feed.ts) — **نفس الـ endpoint، مُحلَّل بمنطقين مختلفين تماماً في ملفين مختلفين** | `getCategories` (نموذج الكاتب فقط)، `fetchCategoryIndex`→`getCategoryById`/`getCategoryBySlug` (تحليل شجرة الأقسام لصفحات القسم) |
| `GET /{locale}/videos`, `/videos/featured`, `/videos/trending`, `/video-categories/{slug}` | `PublicVideoCardResource` | `VideoSchema`/`VideoListEnvelope` (`videos.ts:70-127`) | `mapVideo` | `getLatestVideos`/`getFeaturedVideos`/`getTrendingVideos`/`getMostViewedVideos`/`getVideosByCategory` |
| `GET /{locale}/videos/{slug}` | `PublicVideoResource extends Card` | نفس `VideoSchema` | `mapVideo` | `getVideo`، `videos/[idslug]/page.tsx` |
| `GET /{locale}/videos/{slug}/related` | `PublicVideoCardResource` | `VideoSchema`/`VideoListEnvelope` | `mapVideo` | `getRelatedVideos` |
| `GET /{locale}/playlists`, `/playlists/{slug}` | `PublicPlaylistResource` (صفّ واحد للقائمة والتفاصيل) | `PlaylistSchema` | `mapPlaylist` | `getPlaylists`/`getPlaylist` |
| `GET /{locale}/reels`, `/reels/featured`, `/reels/trending`, `/reels/{slug}` | `PublicReelResource` (صفّ واحد للأربعة) | `ReelSchema` | `mapReel` | `getReelsFeed`/`getReelByIdSlug` |
| `GET /{kind}`, `/{kind}/{slug}` (live\|tv\|radio، **بلا بادئة لغة**) | `PublicBroadcastCardResource`/`PublicBroadcastResource` | `broadcast.ts`'s schema (تحقّق: يطابق `{likes,dislikes}` الفعليّ تماماً) | inline mapper | `live/[slug]`, `tv/[slug]`, `radio/[slug]` |
| `GET /{locale}/epaper` | `PublicEpaperListItemResource` | `EpaperItemSchema`/`ListEnvelope` (`epaper.ts:56-80`) | `mapIssue` | `getEpapers`، صفحة `/epaper`، `/newspaper/[idslug]` |
| `GET /{locale}/writers/{id}` | `PublicWriterResource` | `WriterSchema` (`writer.ts:9-21`) | inline (`writer.ts:41-47`) | `getWriterProfile`، `writer/[id]/page.tsx` |
| `GET /site` | (site settings resource) | `SiteSettingsSchema` (`site-settings.ts:56-107`) | inline | `getSiteSettings` — أكثر من 10 مستهلك (layout الجذر، الهيدر، الفوتر، manifest، …) |
| `GET /article-categories` | (نموذج كاتب) | `WriterCategorySchema` | inline | `getArticleCategories` (نموذج إنشاء المحتوى فقط) |

### الإجابات المباشرة على الأسئلة الأربعة

**هل جميع حقول Laravel مستهلكة؟ لا.**
- **مستوى الـ endpoint بالكامل**: `/articles/trending` و`/articles/breaking` غير مستهلكين إطلاقاً (أعلاه).
- **مستوى الحقل**: `Video`/`Playlist` يرسلان `locale` دائماً (top-level) ولا يظهر في أيّ من واجهتي `VideoItem`/`PlaylistItem`؛ `Reel`'s `media.processing_status` مُرسَل دوماً وغير مُستهلَك بواجهة `ReelItem`؛ `Broadcast`'s الحقول الموسومة صراحة "admin-only" (`source_url` خارج سياق `live`, `health`, `is_public`, `meta`, `created_by`) مُستبعَدة عمداً من الـ Resource أصلاً (تصميم سليم، ليس تسريباً).

**هل توجد حقول في Zod لا يعيدها الـ API؟ نعم — أهمّها اثنان:**
1. **`is_featured` على `FeedItem`** (`feed.ts:44,127`) — لا يُرسَله `PublicArticleListItemResource` إطلاقاً (تأكّد بقراءة الملف مباشرة: لا وجود لأي مفتاح `is_featured` في السطور 19-50). النتيجة: `mapItem().is_featured` = `false` دائماً على كل قوائم/خلاصات المقالات. **هذا خاصّ بـ Article فقط** — تأكّدنا أنّ Video وPlaylist وReel وBroadcast ترسل `is_featured` بشكل سليم في مورد القائمة نفسه (`PublicVideoCardResource.php:33`، `PublicPlaylistResource.php:27`، `PublicReelResource.php:27`، `PublicBroadcastCardResource.php:34`).
2. **`media.url` على `VideoSchema`** (`videos.ts:97`) — لا يوجد حقل حرفيّ اسمه `url` في أيّ من فرعَي `mediaPayload()`'s discriminated union (`external`: kind/provider/embed_url/source_url/poster؛ `uploaded`: kind/poster/hls/renditions/processing_status) — **مؤكَّد بقراءة `PublicVideoCardResource.php` مباشرة**.

**هل توجد حقول يعيدها الـ API ولا تُستخدم؟ نعم (انظر الفقرة الأولى)، والأهمّ عدم استهلاك endpoint كامل (`/articles/trending`، `/articles/breaking`).**

**هل توجد حقول اختيارية أصبحت إلزاميّة أو العكس؟ حالة واحدة خطيرة محتملة، تستحقّ التحقّق الفوريّ:**

> **`Video.media.renditions` — تعارض نوع حقيقيّ، لا مجرّد اختياريّة.**
> Zod (`videos.ts:101`): `renditions: z.array(z.object({url:...})).nullish()` — **مصفوفة**.
> الباك إند الفعليّ (`MediaAsset::renditionUrls()`, `app/Models/MediaAsset.php:217-235`): يعيد **خريطة مفتاحية** (`{master: url, "480p": url, ...}`) — **كائن، لا مصفوفة**.
> بالمقارنة: `Reel.media.renditions` يُمثَّل بشكل صحيح في الواجهة كـ `z.record(...)` (كائن) — أي أنّ فريق التطوير يعرف الشكل الصحيح ويطبّقه في Reel، لكن Video لا يزال يستخدم `z.array(...)`.
> **الأثر المُستنتَج منطقيّاً (لم يُختبَر حيّاً بطلب فعليّ)**: بما أنّ `.nullish()` تتسامح فقط مع `null`/`undefined`، لا مع نوع مختلف، فإنّ أيّ فيديو "مرفوع" (uploaded، له `renditions` غير فارغة) داخل استجابة قائمة سيؤدّي — منطقيّاً — إلى فشل `VideoSchema.safeParse()` بالكامل لتلك الاستجابة، وبالتالي `fetchCardList()` تُعيد `[]` **لكامل القائمة، لا لعنصر واحد فقط** (`videos.ts:198-209`، شرط `if (!parsed.success) return [];`).
> **أولوية تحقّق فوريّة، منخفضة التكلفة، عالية الأثر المحتمل**: افحص استجابة حقيقيّة واحدة من `/videos` تحتوي فيديو مرفوعاً بمعالجة مكتملة؛ إن صحّ الاستنتاج، فالإصلاح سطر واحد (`z.record(z.string(), z.string().nullish())` بدل `z.array(...)`) لكنّ الأثر الحاليّ المحتمل هو اختفاء صامت لقوائم فيديو كاملة.

---

## 2. Feed Architecture

### الخلاصات المطلوبة والدوال الفعليّة

| Feed | الدالّة | آليّة الترقيم | يُشارك منطقاً مع؟ |
|---|---|---|---|
| Homepage | `getHomepageFeed` (`feed.ts:187`) | BFF مجمَّع، endpoint خاصّ | لا أحد — الوحيدة التي تستدعي `/homepage` |
| Category (خلاصة ثابتة) | `getCategoryFeed` (`feed.ts:308`) | cursor، `filter[category]` | نفس نمط `getTagFeed`/`getAuthorArticles` تماماً |
| Category (صفحة مُرقَّمة) | `getCategoryPage` (`feed.ts:407`) | traditional page/per_page، `filter[category]` | **نفس نمط `getWriterArticles`/`searchArticles` تماماً — انظر أدناه** |
| Writer | `getWriterArticles` (`writer.ts:58`) | traditional، `filter[author_id]` | مطابق شبه-حرفيّ لـ`getCategoryPage` |
| Opinion | **لا توجد دالّة مخصَّصة** | — | `type=opinion` هو مجرّد قيمة `filter` تُمرَّر لـ `getAuthorArticles`/نموذج الكاتب — لا توجد صفحة فهرس Opinion مستقلّة إطلاقاً (تأكّد: لا مسار `opinion` تحت `app/`) |
| Search | `searchArticles` (`search.ts:37`) | traditional، `filter[q]`، **بلا `sort`** (يحافظ على ترتيب صلة Meilisearch) | نفس هيكليّة `getCategoryPage`/`getWriterArticles` لكن بمرشِّح مختلف |
| Related (على صفحة المقال) | مزيج: `getTagFeed`→`getCategoryFeed`→`getEditorsPickFeed`→`getLatestFeed` (سلسلة fallback، `article/[id]/page.tsx:87-101`) | cursor لكلّ مصدر | يستهلك 4 دوال cursor-mode موجودة مسبقاً — لا تكرار جديد هنا، لكنّه يُظهر أنّ 4 استدعاءات API منفصلة قد تُطلَق فقط لملء قسم "ذات صلة" واحد إذا فشلت كل المستويات الأولى (نادر لكن ممكن) |
| Latest | `getLatestFeed` (`feed.ts:221`) | `/feed/latest` | جزء من عائلة `fetchFeed` العامّة |
| Most Read | `getMostReadFeed` (`feed.ts:233`) | endpoint مستقلّ `/articles/most-read` | — |
| Breaking | `getBreakingFeed` (`feed.ts:227`) | `/feed/breaking` | جزء من عائلة `fetchFeed` |

### هل يوجد تكرار في المنطق؟ نعم — موثَّق بدقّة

**تكرار من الدرجة الأولى (traditional pagination + مرشِّح واحد):** ثلاث دوال —
`getCategoryPage` (feed.ts)، `getWriterArticles` (writer.ts)،
`searchArticles` (search.ts) — تُنفِّذ **نفس الخطوات الخمس** بشكل مستقلّ:
بناء `URLSearchParams` بـ `per_page`/`page` (+`sort` اختياريّ)، تعيين مفتاح
مرشِّح واحد (`filter[category]` أو `filter[author_id]` أو `filter[q]`)، طلب
`/articles?...`، تحليل عبر `PaginatedEnvelope`/مطابق، تفكيك
`meta.pagination` إلى `{items,total,page,totalPages}`. الفروقات الحقيقيّة
الوحيدة: مفتاح المرشِّح، وكون `searchArticles` تحذف `sort` عمداً.

**تكرار من الدرجة الثانية (cursor + مرشِّح واحد):** ثلاث دوال أخرى —
`getCategoryFeed`، `getTagFeed`، `getAuthorArticles` (الثلاثة في `feed.ts`) —
نفس النمط بالضبط لكن بـ `paginate=cursor` بدل الترقيم التقليديّ.

**هل يمكن توحيد الـ Feed Layer؟ نعم، بوضوح.** الأنماط الستّة أعلاه تختزل
فعليّاً إلى دالّتين عامّتين فقط: `fetchPaginatedArticles(filterKey,
filterValue, {page,perPage,locale,sort?})` و `fetchCursorArticles(filterKey,
filterValue, {limit,locale})` — يُستدعيان بمرشِّح مختلف من كل موقع استدعاء
حاليّ. هذا تبسيط حقيقيّ مدعوم بالدليل، لا افتراضاً نظريّاً: **6 دوال، منطق
مطابق فعليّاً لخطوة-بخطوة، فرق وحيد هو اسم المرشِّح.**

### هل يوجد Mapping مكرَّر؟ لا — هذا الجزء مبنيّ جيّداً

`mapItem()` (feed.ts) هو المطابِق الوحيد لكل أشكال "بطاقة القائمة" عبر 9
دوال مختلفة (تحقّق مباشر) — إعادة استخدام حقيقيّة، لا تكرار. كل نوع محتوى
آخر (Article التفصيليّ، Video، Reel، Epaper، Playlist) له مطابِق واحد فقط
خاصّ به. **الاستثناء الوحيد**: تحليل شجرة `/categories` نفسها يحدث بمنطقين
منفصلين تماماً — `flatten()` في `categories.ts` و`walk()` inline في
`feed.ts`'s `fetchCategoryIndex` — لنفس الـ endpoint بالضبط، بدل مشاركة
مطابِق واحد (انظر جدول §1).

### هل يوجد Cache مكرَّر؟ نعم — تطبيق غير متّسق، لا تكرار حرفيّ

طبقة الكاش الإضافيّة في وضع التطوير (`getCached`/`apiCache`، معطَّلة في
الإنتاج) **مُعرَّفة حرفيّاً 3 مرّات منفصلة** في `feed.ts`، `site-settings.ts`،
`reels.ts` (نفس المنطق بالضبط، بدون ملف مشترك). والأهمّ: تُطبَّق بشكل
انتقائيّ بلا قاعدة معماريّة واضحة — `getHomepageFeed`/`getCategoryFeed`/
`fetchCategoryIndex` تستخدمها، بينما الأشقّاء البنيويّون المطابقون تماماً
(`getTagFeed`، `getAuthorArticles`، `getCategoryPage`، `getWriterArticles`،
`searchArticles`) لا يستخدمونها إطلاقاً — لا يوجد سبب معماريّ موثَّق للفرق.

---

## 3. BFF Audit

كل الـ 30 route handler تحت `app/api` صُنِّفت أدناه. **النتيجة الصادقة: لا
يوجد أي route "Redundant" بالمعنى الصارم (قيمة صفريّة)** — المعماريّة
تبنّت بثبات مبدأ "المتصفّح لا يكلّم Laravel مباشرة أبداً"، وكل route يخدم
هذا المبدأ على الأقلّ حتى عندما لا يكون "ضروريّاً تقنيّاً" بمعنى صارم. هذا
استنتاج مبنيّ على الدليل، لا افتراضاً — لم أُجبِر تصنيفاً وهميّاً لملء خانة.

| Route | التصنيف | السبب |
|---|---|---|
| `auth/login`, `auth/register` | **Required** | تعيين كوكي httpOnly من استجابة عابرة للنطاقات — لا بديل من المتصفّح مباشرة |
| `auth/social/finish` | **Required** | تسليم جلسة، لا نداء صادر إطلاقاً — تعريفيّاً يجب أن يكون هنا |
| `auth/avatar`, `media/*`, `account/phone` | **Required** | تمرير كوكي Bearer httpOnly — لا يمكن للمتصفّح الوصول للتوكن مباشرة |
| `epaper/[idslug]` | **Required** | موثَّق صراحة: نفس-الأصل مطلوب لعارض pdf.js لتفادي CORS |
| `weather` | **Required** | يُخفي مفتاح OpenWeather (يجب أن يبقى خادميّاً حصراً، `env.ts`) |
| `revalidate` | **Required** | webhook داخل من Laravel، لا نداء صادر — تعريفيّاً خادميّ |
| `engagement/*` (4)، `follow/*` (2) | **Required** | منطق تفويض مركزيّ (bearer اختياريّ + X-Client-Id + حالات مجهول اصطناعيّة) عبر forwarder مشترك |
| `auth/me` | **Useful** | تجميع فعليّ (نداءان لارافيليّان بنداء واحد) — قيمة حقيقيّة تتجاوز proxy بسيط |
| `live-updates` | **Useful** | يضيف قيمة حقيقيّة (تمرير ETag/If-None-Match) تتجاوز proxy بسيط |
| `ads/batch`, `ads/serve/[zoneKey]`, `ads/click`, `ads/impression` | **Useful** | تحقّق/allow-list من جهة الخادم (`ads/serve` يتحقّق من `zoneKey` بـ regex)، اتّساق مع باقي المعماريّة |
| `advertise`, `contact`, `whatsapp/subscribe`, `whatsapp/unsubscribe`, `auth/forgot` | **Useful** | غير مطلوبة تقنيّاً بصرامة (لا كوكي، لا سرّ) لكن متّسقة مع مبدأ "نفس الأصل دائماً" المُتبنّى في كامل المعماريّة |
| `reels` | **Useful** | ضروريّة للتمرير اللانهائيّ من طرف العميل (الصفحة الأولى SSR مباشرة، الصفحات التالية عبر هذا الـ route) — **لكن تحمل خللاً موروثاً**: تستدعي `getReelsFeed(cursor)` بلا تمرير locale، فتُقفَل دائماً على `'ar'` (نفس نمط الخلل في الملاحظة M7 بالتقرير الأوّل) |
| `tts` | **Useful** | تمركز تكلفة/معدّل التوليد الصوتيّ خادميّاً بدل تعريض Laravel مباشرة |
| `comments` | **Useful (بخلل i18n كامن)** | بنية تفويض سليمة (bearer اختياريّ)، لكن `locale` مُثبَّت حرفيّاً `'ar'` — راكد اليوم فقط لأنّ صفحة EN لا تعرض قسم التعليقات إطلاقاً |

**ملاحظة تكرار كود (لا تصنيف route منفصل)**: `ads/batch/route.ts` و
`ads/serve/[zoneKey]/route.ts` لا يُعيدان استخدام `ads-bff.ts` — كل منهما
يُعيد كتابة نفس نمط ترويسات `NO_STORE`/تمرير `X-Client-Id` يدويّاً بدل
استدعاء `forwardAdBeacon` المشترك. هذا تكرار كود، لا تكرار وظيفيّ على
مستوى الـ route.

---

## 4. ISR / Cache Matrix

مبنيّة من جرد كامل لكل صفحة (تأكيد مباشر من قراءة كل ملف). الأعمدة
المطلوبة، حيث `dedupe` = هل الدالّة مُغلَّفة بـ `React.cache()`.

| الصفحة | revalidate | dedupe (`cache()`) | fetch cache (`next:{revalidate,tags}`) | ملاحظة |
|---|---|---|---|---|
| `/` (الرئيسية) | 3600s (page-level) | نعم لكل الدوال المُستدعاة | 120s (`homepage` tag)، لكن كل قسم فرعيّ (LatestUpdates، CategoryFeatureQuad ×3، …) له `revalidate` خاصّ به داخليّاً | Page-level 3600s **لا يعني شيئاً عمليّاً** — المحتوى الفعليّ يتحدَّث حسب أقصر TTL بين الأقسام الفرعيّة (120s–300s)، وهذا تضارب تسمية: رقم الصفحة (3600) لا يعكس واقع التحديث الفعليّ |
| `(site)/layout.tsx` (كل الصفحات) | — | نعم | `getHomepageFeed`: 120s | **يجلب التجميعة الكاملة (5 مناطق) لاستخدام 2 فقط (`latest`,`breaking`)** — انظر §6 |
| `/article/[id]` | 21600s (6h) | نعم | متفاوت لكل استدعاء فرعيّ (COUNT من 9 نداءات متوازية، كلّ بـ TTL مستقلّ 60–300s) | الصفحة تُصنَّف "6 ساعات" لكن أغلب الأقسام الفرعيّة تتحدَّث كل 300s أو أقلّ عمليّاً — تسمية page-level مُضلِّلة كما أعلاه |
| `/category-[id]/[name]` (ar+en) | 21600s | نعم (لكن `getCategoryById` مُستدعاة مرّتين — في `generateMetadata` وبالجسم — نفس القيمة، فتُدمَج) | 300s | له `loading.tsx` خاصّ — الوحيدة (مع نظيرتها EN) بين كل الصفحات |
| `/writer/[id]` | 60s | نعم | 300s (بروفايل)، 300s (مقالات) | فجوة: صفحة كاملة بـ `revalidate=60` لكن بياناتها الفعليّة مكاشة 300s — الصفحة تُعاد بناؤها كل دقيقة لتُخرِج نفس المحتوى المكاش لخمس دقائق |
| `/search` | — (ديناميكيّة ضمنيّاً عبر `searchParams`) | نعم | 60s | — |
| `/latest` | 60s | نعم | 60s | متّسقة |
| `/trending` | 300s | نعم | 300s (نفس TTL الأكثر-قراءة) | متّسقة، لكن راجع §1 حول تسمية "trending" مقابل خوارزميّة "most-read" الفعليّة |
| `sport/*` (competition/match/player/team) | — (بلا export) | **لا — الوحيدة غير المُغلَّفة بـ `cache()` في كامل `lib/`** | متفاوت | **جلب مضاعَف مؤكَّد**: `generateMetadata` والجسم يستدعيان نفس الدالّة بنفس المعاملات، بلا cache() فيُنفَّذ الطلب مرّتين فعليّاً — ليس نظريّاً |
| `(reels)/reels/[idslug]` | 21600s | **لا** (`getReelByIdSlug` دالّة `async` عاديّة) | 60s | نفس عيب sport/* بالضبط |
| `en/author/[id]` | 300s | نعم لكن بمعاملات مختلفة (`limit:1` في generateMetadata مقابل `limit:24` بالجسم) | 300s | التخزين المؤقّت مبنيّ على كامل قائمة المعاملات، فاختلاف `limit` يُبطِل الدمج — نداءان فعليّان رغم `cache()` |

### التضارب/المشاكل المكتشفة في هذه المصفوفة

1. **تضارب تسمية page-level مقابل الواقع**: أرقام `revalidate` على مستوى
   الصفحة (`/`: 3600s، `/article/[id]`: 21600s) لا تعكس معدّل التحديث
   الفعليّ للمحتوى المعروض (120s–300s لمعظم الأقسام) — هذا ليس "بيانات
   قديمة" فعليّاً (المحتوى يتحدَّث بمعدّله الحقيقيّ الأقصر) لكنّه تضليل توثيقيّ:
   أي مطوّر يقرأ `revalidate=21600` سيفترض تحديثاً كل 6 ساعات، بينما
   الحقيقة أسرع بكثير.
2. **`getWriterArticles`/`getWriterProfile` (300s) تحت صفحة بـ
   `revalidate=60`**: إعادة بناء الصفحة كل دقيقة لإخراج بيانات مُثبَّتة
   لخمس دقائق — هدر بنائيّ بلا فائدة فعليّة (لا "بيانات أحدث" تظهر بين
   إعادات البناء المتكرّرة).
3. **إعادة جلب غير ضروريّة مؤكَّدة (لا نظريّة)**: `sport/*` (كل الصفحات
   الأربع) و`(reels)/reels/[idslug]` — دوالّ غير مُغلَّفة بـ `cache()`، تُستدعى
   مرّتين حرفيّاً (generateMetadata + الجسم) بنفس المعاملات.
4. **Waterfall حقيقيّ واحد مؤكَّد**: `sport/competition/[id]/page.tsx` —
   3 مراحل متتالية (`getCompetitionMeta` ← `Promise.all` من 7 ← `Promise.all`
   من 2 يعتمد على نتيجة المرحلة السابقة) — الأعمق في كامل الموقع.
   `sport/team/[id]/page.tsx` أبسط لكن **تسلسليّ بحت** (`await` ثم `await`،
   بلا `Promise.all` إطلاقاً).

---

## 5. Component Reuse

### بطاقات المقال — 7 تطبيقات لنفس المفهوم (`FeedItem`)

| المكوّن | التخطيط | مواقع الاستخدام | ملاحظة |
|---|---|---|---|
| `ArticleCard` | عموديّ، صورة `<img>` خام، بلا تصنيف/badge/كاتب | 5 مواقع (نشاط الحساب، `FeedSection` بصفحة المقال، قالب الرأي، `CompactPairSection`، `/search`) | الوحيدة بلا أي عرض للتصنيف |
| `HorizontalArticleCard` | أفقيّ (صورة+نصّ)، `OptimizedImage`، badge، شريط تفاعل | صفحة الكاتب، صفحة القسم **ar وen معاً** | — |
| `FeaturedCategoryCard` | عموديّ كبير "mini-hero"، مقتطف، شريط تفاعل | صفحة القسم ar (أوّل عنصرين) وen (عنصر واحد حسب `is_featured`) | — |
| `FeedCard` | عموديّ بلا حدود | **`/latest` فقط** | **تعليق الملفّ نفسه يدّعي كذباً أنّه "مُعاد استخدامه في /latest و/category"** — صفحة القسم تستخدم فعليّاً `FeaturedCategoryCard`+`HorizontalArticleCard` بدلاً منه |
| `EnArticleCard` | 5 variants داخل ملفّ واحد (hero/feature/standard/list/compact) | en/الرئيسية، en/الكاتب، en/المقال، `EnSidebar` | الوحيدة التي تعرض `item.author` |
| `BannerTripleSection` | مركَّبة (feature+3 صفوف) | **لا أحد — orphaned تماماً** | صفر مستدعٍ في كل الشجرة |
| `CompactPairSection` | مركَّبة (تُعيد استخدام `ArticleCard` فعليّاً + 6 صفوف) | **لا أحد — orphaned تماماً** | المفارقة: هذه الوحيدة التي تُطبِّق DRY حقيقيّاً (بتعليقها الخاصّ) لكنّها غير مُستخدَمة |

**الاكتشاف الأخطر في هذا القسم — عبور لغويّ حقيقيّ ومؤكَّد:**
`en/category/[id]/[name]/page.tsx` يستورد **نفس** `HorizontalArticleCard`/
`FeaturedCategoryCard` العربيّتين (لا `EnArticleCard`). وكلتاهما تستدعيان
`formatRelativeTime` (`lib/format.ts:15`) المُثبَّتة حرفيّاً على
`Intl.RelativeTimeFormat('ar', ...)`، ونصوص الـ badge من `lib/feed.ts`'s
`toBadge()` (`'تغطية خاصة'`, `'عاجل'` — عربيّة حرفيّاً). **النتيجة: صفحة
القسم الإنجليزيّة تعرض تواريخ نسبيّة عربيّة ("منذ 3 ساعات") ونصوص badge
عربيّة داخل صفحة إنجليزيّة بالكامل خلاف ذلك.** هذا يُوسِّع نتيجة H1 في
التقرير الأوّل (الشريط الجانبيّ) — الخلل نفسه (نسيان تمرير locale) يتكرّر
هنا بشكل أكثر وضوحاً بصريّاً للمستخدم.

### الهيرو — 12 تطبيقاً مستقلاً، بلا اشتراك كود

5 ملفّات باسم "hero" صريح + 5 أنماط "عنصر بارز أكبر من البقيّة" داخل أقسام
الرئيسية (`category-three-col`, `category-feature-quad`,
`category-editorial-section`, `latest-updates`, `broadcast-live-section`) +
`EnArticleCard`'s `variant="hero"` + `BannerTripleSection` (orphaned) = **12
تطبيقاً، لا يستورد أيّ منها الآخر**. كل قسم من أقسام الرئيسية الاثني عشر
أعاد اختراع نمط "عنصر رئيسيّ أكبر + شبكة صغار" من الصفر.

### الشريط الجانبيّ — تطبيق مشترك واحد حقيقيّ + 6 تطبيقات منفردة

`ReadingSidebar`/`SidebarNewsWidget` مُعاد استخدامه فعليّاً بـ 6 مواقع
استدعاء (المقال، القسم ar/en، الكاتب، الصفحات الثابتة، 404) — **هذا مثال
DRY حقيقيّ وموثَّق بتعليق صريح في الكود**. لكن: `EnSidebar` (en/الرئيسية
فقط)، `ReelsSidebar` (تنقّل، ليس محتوى)، `CompetitionMatchesSidebar`
(رياضة)، `WatchSidebar`/`RelatedSidebar` (inline، غير مُستخرَجة كملفّ
مستقلّ حتى) — 6 تطبيقات منفردة إضافيّة، كلّ صفحة نوعها الخاصّ.

### الترقيم — 4 أنماط مختلفة، ليس نمطاً واحداً

`ui/pagination.tsx` (المُرقَّم الكلاسيكيّ) مُستخدَم في 4 مواقع فقط (الكاتب،
القسم ar/en، البحث). إلى جانبه: ترقيم يدويّ منفصل بالكامل في
`activity-view.tsx` (المحفوظات/الإعجابات)، تمرير لانهائيّ بـ cursor في
`reels-feed.tsx`، وتنقّل صفحات PDF في قارئ الجريدة الرقميّة — **4 حلول
مستقلّة لنفس المشكلة العامّة**، بلا اشتراك كود بينها.

### الهيدر/الفوتر — en منفصل تماماً عن Qalah، بتصميم متوازٍ يدويّاً

`en/layout.tsx` يستخدم `EnHeader`/`EnFooter` (ملفّان مستقلّان بالكامل، لا
يستوردان أيّ شيء من `components/layout/qalah/`). تعليقات الملفّين تصف
العلاقة بـ "مطابقة بصريّة يدويّة لتصميم Qalah" — لا اشتراك كود، مجرّد نسخ
تصميم يدويّاً. بالإضافة: 3 مكوّنات "قشرة قديمة" ميتة تماماً (صفر مستوردين):
`site-header.tsx`→`main-nav.tsx`/`mobile-nav.tsx`، و`breaking-bar.tsx`
(الشريط الفعليّ الحيّ اسمه مختلف: `breaking-news-bar.tsx`).

### هل يمكن دمج مكوّنات؟ نعم — بترتيب أولويّة عمليّ

1. **حذف فوريّ بلا مخاطرة**: `BannerTripleSection`، `CompactPairSection`،
   و`main-nav.tsx`/`mobile-nav.tsx`/`site-header.tsx`/`breaking-bar.tsx` —
   ميتة 100%، صفر مستوردين، حذفها لا يغيّر أي سلوك مرئيّ.
2. **دمج ضيّق وعالي العائد**: توحيد `HorizontalArticleCard` و
   `FeaturedCategoryCard` (نمطان فقط من الأصل 4 "بطاقات مقال قياسيّة" غير
   المُتخصِّصة) عبر متغيّر `variant` واحد، على غرار ما فعلته `EnArticleCard`
   بالفعل — نمط مُثبَت أصلاً في الكودبيس، لا حاجة لاختراعه.
3. **دمج أوسع، عالي التكلفة**: توحيد نظام البطاقات بالكامل (7→2-3) ونظام
   الهيرو (12→2-3) يتطلّب قراراً تصميميّاً/منتجيّاً حول أيّ نمط "يفوز" لكل
   سياق، واختباراً شاملاً عبر كل صفحة متأثِّرة — مبرَّر معماريّاً لكنّه ليس
   إصلاحاً سريعاً.

---

## 6. API Efficiency

| الصفحة | عدد الطلبات (مسار مباشر، تقديريّ) | متوازية؟ | متكرّرة؟ | Over/Under-fetching؟ |
|---|---|---|---|---|
| `/` (الرئيسية) | 3 أوّليّة (`Promise.all`) + ~15-18 طلباً فرعيّاً مستقلاً (قسم لكل `<Suspense>`) | نعم — كل قسم يبدأ الجلب فور الوصول لحدّه، لا حجب متسلسل | لا | **Over-fetch مؤكَّد**: `getHomepageFeed` (5 مناطق) تُطلَب في `page.tsx` بينما `heroItems`/`editorsPick` فقط تُستخدَمان مباشرة (باقي المناطق تُستهلَك عبر استدعاءات أقسام أخرى منفصلة) |
| كل صفحة غير الرئيسية (عبر `(site)/layout.tsx`) | +1 طلب تجميعة كاملة (5 مناطق) لاستخدام 2 فقط | — | **نعم، مؤكَّد وممنهج سيتيّاً** | **Over-fetch مؤكَّد وواسع**: يتكرّر على *كل* تحميل صفحة في كامل `(site)` — انظر M6 بالتقرير الأوّل |
| `/article/[id]` | 1 (بوّابة) + 9 متوازية (`Promise.all`) = 10 | نعم للمجموعة الثانية | لا | متوازن — لا استغلال زائد ظاهر |
| `sport/competition/[id]` | 1 + 7 متوازية + 2 (تعتمد على السابقة) = 10، **+نداء مضاعَف من `generateMetadata`** | جزئيّاً (مرحلتان متوازيتان، لكن 3 مراحل إجمالاً) | **نعم، مؤكَّد** (`getCompetitionMeta` مرّتين) | الأعقد في الموقع بالكامل |
| `sport/team/[id]` | 2، **تسلسليّ بحت** (بلا `Promise.all` إطلاقاً) + نداء مضاعَف من generateMetadata | **لا** | **نعم، مؤكَّد** | Under-parallelized بمعنى حرفيّ — الصفحة الوحيدة التي لا تستخدم `Promise.all` نهائيّاً رغم وجود أكثر من نداء |
| `(reels)/reels/[idslug]` | 4 متوازية (`Promise.all`) + نداء مضاعَف لـ `getReelByIdSlug` من generateMetadata | نعم للمجموعة، لا للمكرَّر | **نعم، مؤكَّد** | — |
| `en/author/[id]` | 2 (`limit:1` بـ generateMetadata، `limit:24` بالجسم) | — | **نعم، مؤكَّد** (معامل مختلف = مفتاح كاش مختلف) | Under-fetch طفيف بمعنى معاكس: نداء كامل بحجم استجابة article فقط لقراءة اسم مؤلّف واحد |
| `/videos` | حتى 12 نداءً (دفعتان: 3 ثمّ حتى 4 + fan-out لكل تصنيف/قائمة مكتشَفة) | مرحلتان متوازيتان، الثانية تعتمد على نتائج الأولى | لا | الأكثر عدد طلبات في الموقع، لكن مُبرَّر بطبيعة الصفحة (فهرس مكتبة) |

**الخلاصة الكمّيّة**: الفجوة الأكثر تكراراً عبر الموقع بأكمله ليست في صفحة
واحدة بل في **الـ layout المشترك نفسه** (over-fetch التجميعة الكاملة على
كل صفحة)، والفجوة الأكثر حدّة في صفحة واحدة هي `sport/team/[id]`
(تسلسليّ بحت + مضاعَف).

---

## 7. Future Scalability

| المحور | نقاط القوّة | نقاط الضعف |
|---|---|---|
| **Mobile App** | طبقة `lib/` توفّر عقوداً JSON نظيفة مُتحقَّق منها بـ Zod (id/title/canonical_path/…) — قابلة لإعادة الاستخدام مباشرة لو استهلك تطبيق جوّال نفس Laravel API | تحويلة `X-Internal-Token` لتجاوز حدّ 120/دقيقة هي SSR-إلى-باك-إند حصراً؛ تطبيق جوّال سيكون "عميلاً عامّاً" حقيقيّاً يخضع لنفس حدّ Rate Limit الذي يخضع له أي متصفّح — عامل سعة يجب التخطيط له، لا افتراض أنّ الوضع الحاليّ يتّسع تلقائيّاً |
| **AMP** | — | المعماريّة بالكامل React/مكوّنات عميل/hooks تفاعليّة (تفاعل، متابعة، تعليقات) — AMP يتطلّب مجموعة HTML/JS محدودة جدّاً؛ لا شيء في البنية الحاليّة يُسرِّع هذا، سيحتاج قالباً موازياً مبسَّطاً بالكامل من الصفر |
| **GraphQL** | الباك إند REST/Resource-based نظيف نمطيّاً — لا شيء يمنع بناء طبقة GraphQL أمام نفس الـ Actions (نمط شائع) | لا أساس حاليّ (لا schema، لا resolvers) — عمل جديد بالكامل، ليس امتداداً طبيعيّاً للوضع الحاليّ |
| **Multi Site** | فصل نظيف نسبيّاً بين طبقة البيانات (`lib/`) والعرض (`components/`) | **ضعف حقيقيّ وموثَّق**: معرّفات التصنيفات (`categoryId` 2/31/36/37/42/43/49/51/53/55/56/58) **مُثبَّتة حرفيّاً داخل الكود المصدريّ** لـ `(site)/page.tsx` و`en/page.tsx` — تشغيل موقع ثانٍ بأقسام مختلفة يتطلّب تعديل كود، لا إعداداً فقط |
| **White Label** | نمط الإحالة بالمعرّف الرقميّ (لا slug) للتصنيفات مصمَّم أصلاً ليقاوم تغييرات إعادة التسمية | نفس ضعف Multi-Site: أسماء العلامة الاحتياطيّة، فئات CSS (`qalah-skin`, `en-skin`)، ومعرّفات الأقسام كلّها مُدمَجة بالمصدر لا بالإعداد/CMS |
| **Multi Language** | البنية التحتيّة *تدعم* تعدّد اللغات فعليّاً (كل دوال `lib/` تقريباً تقبل `locale`) | **مؤكَّد بالدليل: EN ليست امتداداً حقيقيّاً لطبقة i18n عامّة، بل شجرة موازية شبه-منفصلة** — هيدر/فوتر/بطاقات/شريط جانبيّ مستقلّة بالكامل عن نظيراتها العربيّة، معرّفات تصنيف مُثبَّتة كسلاسل حرفيّة (`'public-news'`) بدل نمط المعرّف الرقميّ المُتّبع بالعربيّة، و3 مسارات BFF مُثبَّتة على `'ar'` حرفيّاً. **إضافة لغة ثالثة تعني على الأرجح تكرار هذا الجهد الموازي من جديد، لا توسيع طبقة عامّة موجودة.** |
| **Headless API** | الباك إند **مصمَّم Headless فعليّاً وبنجاح** — JSON Resources نظيفة، `/api/v1` مُرقَّم، لا تسريب لأي تفصيل خاصّ بـ Next.js في شكل الاستجابة | — |

---

## 8. Overall Architecture Score

| المحور | الدرجة /10 | السبب المختصر |
|---|---|---|
| API Design | **7** | allow-lists نظيفة، Resources منضبطة (تُخفي الحقول الحسّاسة عمداً في Broadcast)، لكن `is_featured` غائب عن Article فقط، وendpoint كامل (`trending`) ميت |
| Frontend Architecture | **7** | App Router صحيح، فصل بيانات/عرض واضح، Zod في كل مكان تقريباً — لكن 3 قواعد locale مختلفة، over-fetch مُمنهج بالـ layout |
| Component Architecture | **4** | الأضعف بثبات الدليل: 7 بطاقات، 12 هيرو، 7 أشرطة جانبيّة، 4 أنظمة ترقيم، مكوّنان ميتان تماماً، تعليق يكذب عن إعادة الاستخدام |
| Performance | **6** | ISR/`cache()` مُستخدَمة بانضباط في معظم الملفّات، لكن جلب مضاعَف مؤكَّد (لا نظريّ) في sport/* وreels التفاصيل |
| Caching | **7** | استراتيجيّة وسوم/TTL ناضجة ومدروسة (أدلّة من حوادث إنتاج حقيقيّة مُصلَحة)، لكن طبقة dev-cache مُكرَّرة 3 مرّات ومُطبَّقة بلا قاعدة ثابتة |
| SEO | **6** | قويّ على المقال/الكاتب/الصفحات الثابتة (JSON-LD كامل، hreflang) — فجوة حقيقيّة وواسعة على صفحات القسم (عنوان فقط، صفر JSON-LD) |
| Maintainability | **6** | تعليقات عربيّة توثيقيّة ممتازة تشرح "لماذا" بأدلّة حقيقيّة — لكن منطق مُكرَّر 3 مرّات (الترقيم)، ومساعد كاش مُكرَّر 3 مرّات، وتعليقات باتت غير دقيقة (epaper، Article canonicalPath) |
| Scalability | **6** | أساس البيانات/BFF سليم لإضافة عملاء جدد، لكن التعريفات المُثبَّتة (تصنيفات، علامة تجاريّة) تُقيِّد Multi-Site/White-Label فعليّاً |
| Code Consistency | **5** | 3 قواعد locale، 3 قواعد ترويسة مصادقة داخليّة، 4 أنظمة ترقيم، 7 بطاقات لنفس البيانات — عدم اتّساق موثَّق بكثافة |
| Production Readiness | **7** | تاريخ استجابة حوادث حقيقيّ ومسؤول (إصلاح استعلام 44 ثانية، تعطيل كاش الذاكرة بالإنتاج) — لكن صفر `error.tsx` في كل الشجرة، وخللان مؤكَّدان حيّان (H1/الهيرو الإنجليزيّ) |

**المتوسّط العامّ: 6.1/10** — بنية سليمة الأساس مع طبقة بيانات ناضجة، لكن
طبقة العرض (المكوّنات) تراكم عليها دَين تقنيّ حقيقيّ وقابل للقياس.

---

## أهمّ 10 أولويّات مرتّبة حسب العائد (ROI = الأثر ÷ الجهد، لا الخطورة فقط)

| # | الإصلاح | الجهد | الأثر | لماذا هذا الترتيب |
|---|---|---|---|---|
| 1 | **تحقّق فوريّ من تعارض `Video.media.renditions`** (مصفوفة مقابل كائن) | ضئيل جدّاً (فحص استجابة واحدة) | **حرج محتمل** (قد يُسقِط قوائم فيديو كاملة بصمت) | أعلى عائد ممكن — تكلفة التحقّق شبه صفريّة مقابل أثر محتمل بالغ |
| 2 | **تمرير `locale` عبر `SidebarNewsWidget`** | سطر واحد لكل استدعاء (6 مواقع) | High — يُصلِح خللاً حيّاً مؤكَّداً على كل صفحة EN | إصلاح ميكانيكيّ بحت، صفر مخاطرة تصميميّة |
| 3 | **إصلاح تنسيق التاريخ/الـ badge على صفحة القسم الإنجليزيّة** (`HorizontalArticleCard`/`FeaturedCategoryCard` أو تمرير locale لـ`formatRelativeTime`/`toBadge`) | صغير | High — يُصلِح خللاً حيّاً **مرئيّاً مباشرة** للمستخدم (نصّ عربيّ داخل صفحة إنجليزيّة) | — |
| 4 | **تغليف `lib/sport/*.ts` و`reels.ts` بـ `React.cache()`** | ضئيل (سطر واحد لكل دالّة) | Medium-High — يُلغي جلباً مضاعَفاً مؤكَّداً على كل صفحة رياضة وصفحة تفاصيل ريلز | نمط جاهز ومُثبَت فعلاً في باقي `lib/` — نسخ نمط قائم، لا اختراع جديد |
| 5 | **استبدال `getHomepageFeed` في `(site)/layout.tsx` بـ `getLatestFeed`+`getBreakingFeed`** | صغير | Medium — يُلغي over-fetch يتكرّر على *كل* تحميل صفحة في الموقع | تغيير سطرين، دالّتان بديلتان جاهزتان أصلاً |
| 6 | **تحديث تعليقَي `epaper.ts` (السطر 12-14) و`Article.php`'s docblock** | ضئيل جدّاً | Low مباشرة، لكن **يمنع سوء فهم مستقبليّ** يُكلِّف وقت تحقيق كامل (كما حدث في هذه الجلسة نفسها) | صفر مخاطرة، توثيق فقط |
| 7 | **حذف 2 مكوّن orphaned + 4 ملفّات "قشرة قديمة" ميتة** | ضئيل (حذف صريح، صفر مستوردين مؤكَّد) | Low-Medium — يقلِّص سطح الصيانة ويمنع التباس مستقبليّ | مخاطرة شبه معدومة، دليل حذف واضح بالفعل |
| 8 | **توحيد `getCategoryPage`/`getWriterArticles`/`searchArticles` بدالّة عامّة واحدة** | متوسّط | Medium — كل تعديل مستقبليّ على منطق الترقيم يصبح لمسة واحدة بدل 3 | يتطلّب اختباراً عبر 3 صفحات، لكن المنطق مُثبَت الآن أنّه متطابق فعلاً |
| 9 | **إضافة SEO metadata (canonical/OG/Twitter/Breadcrumb JSON-LD) لصفحات القسم** | متوسّط | Medium-High — يُغلِق فجوة SEO حقيقيّة على صفحات عالية الحركة (ar+en) | نمط جاهز فعلاً في `pages/[slug]`/`writer/[id]` — تطبيق نمط قائم لا بناء جديد |
| 10 | **توحيد بطاقتَي `HorizontalArticleCard`/`FeaturedCategoryCard` بـ variant واحد** | متوسّط-كبير | Medium — خطوة أولى واقعيّة نحو تقليص 7→أقلّ، بدل مشروع دمج كامل دفعة واحدة | نمط `variant` مُثبَت أصلاً بـ `EnArticleCard` — تكرار نمط ناجح، لا اختراع |

**ما استُبعِد عمداً من القائمة رغم ذكره بالتقرير**: توحيد كامل نظام
البطاقات (7→2) وكامل نظام الهيرو (12→2-3) — أثر حقيقيّ لكنّه مشروع تصميم/
منتج متعدّد الصفحات، ليس "إصلاحاً" بمعنى ROI سريع؛ يستحقّ خطّة منفصلة لا
بنداً في هذه القائمة.
