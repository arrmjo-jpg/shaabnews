# AlphaCMS — Target Architecture (المرجع الرسميّ)

**الحالة: مُعتمَد.** هذا هو المرجع المعماريّ الرسميّ لِـAlphaCMS — يبني عليه
الفريق. القرارات المفصَّلة (مع البدائل المرفوضة) مسجَّلة كسجلّات قرار
منفصلة في [`docs/adr/001-content-item-core-model.md`](../adr/001-content-item-core-model.md)
حتى [`docs/adr/016-replaceable-infrastructure-behind-boundaries.md`](../adr/016-replaceable-infrastructure-behind-boundaries.md).
هذا المستند هو النسخة الكاملة؛ سجلّات الـADR الفرديّة مقتطفات منه للرجوع
السريع.

**القرار المحوريّ:** المنصّة نواتها `ContentItem` (عقدة محتوى عامّة، كتل
مُنظَّمة)، فصل قراءة/كتابة عبر Projections، عمودٌ حدثيّ بين سياقات محدودة،
AI كطبقة، توزيع من الحافة. `tenant + locale` من الدرجة الأولى منذ اليوم.

**ملاحظة تنفيذيّة (Phase 1):** هذا مرجعٌ للـ**هدف** النهائيّ، وليس وصفاً
للحالة الحاليّة للكود. Phase 1 (راجع
[`docs/roadmap/PHASE1-PROGRESS.md`](../roadmap/PHASE1-PROGRESS.md)) يبني
عمداً **قبل** `ContentItem` — المحتوى يبقى في جداول منفصلة لكلّ نوع
(articles/videos/reels/…) حتى Stage 2 من خارطة التطوّر أدناه؛ راجع
[`docs/adr/E1-defer-content-item-unification.md`](../adr/E1-defer-content-item-unification.md)
لتفصيل هذا القرار التنفيذيّ المرحليّ.

---

## ١) المبادئ المعماريّة

**لن نتنازل عنها طوال عمر المشروع:**
1. **المحتوى عقدة عامّة (`ContentItem`)** — الأنواع حمولات، لا صوامع منفصلة.
2. **جسمٌ كتليّ مُنظَّم** — `content_html` ليس مصدر الحقيقة أبدًا.
3. **فصل القراءة عن الكتابة (CQRS-lite)** — تُقرأ الواجهات من **Projections مخصّصة**، لا من نموذج الكتابة.
4. **MySQL مصدر الحقيقة العَلائقيّ** — الـProjections قابلة للحذف وإعادة البناء دائمًا.
5. **عمودٌ حدثيّ بين السياقات** — الآثار الجانبيّة عبر Domain Events، لا fan-out أمريّ مبعثر.
6. **`tenant + locale` هويّة من الدرجة الأولى** في كلّ نموذج ومفتاح وProjection — منذ اليوم.
7. **توزيع من الحافة** — HTML/API قابلان للكاش على الحافة؛ الأصل لا يخدم ما تخدمه الحافة.
8. **التحرير بيانات لا كود** — التخطيطات والمصادر والترتيب.
9. **عقود API مُصدَّرة (versioned)** — الموبايل والشركاء يعتمدونها.
10. **AI بمُراجَعة بشريّة للكتابة** — لا نشر تلقائيّ أبدًا.
11. **سياقات محدودة بعقودٍ صريحة** — لا وصول لقاعدة سياقٍ آخر.

**لن نفعله إطلاقًا:**
- ❌ **EAV meta** (فخّ WordPress) · ❌ **Event-Sourcing كمصدر حقيقة** · ❌ مخطّط «يبني أيّ شيء» بلا رأي (فخّ Contentful) · ❌ Next.js كبروكسي أصول · ❌ مفاتيح/joins عابرة للسياقات · ❌ تخصيص لكلّ مستخدم داخل كاش الصفحة الكاملة · ❌ **إعادة كتابة big-bang** · ❌ ربط الواجهة بمخطّط الكتابة · ❌ حشر Courses/Forums في `ContentItem`.

---

## ٢) Bounded Contexts

| السياق | المسؤوليّة | Aggregate Roots | Domain Events (يُصدِر) | Public API | تبعيّات مسموحة |
|---|---|---|---|---|---|
| **Identity & Access** | مستخدمون، أدوار، صلاحيّات، **tenants** | `User`, `Role`, `Tenant` | UserRegistered, RoleChanged | AuthN/AuthZ, TenantResolver | — (جذر) |
| **Content** (النواة) | دورة حياة المحتوى ونشره | **`ContentItem`**, `ContentType`, `Taxonomy`, `ContentRelation` | ContentCreated/Published/Updated/Unpublished | ContentRepository, ContentQuery | Identity, Media (ref) |
| **Editorial** | تركيب الصفحات (Composer) | `Surface`, `LayoutVersion`, `LayoutTemplate` | LayoutPublished, PinChanged | SurfaceResolver | Content (ref), AI (ranking) |
| **Media** | أصول، معالجة، R2 | `MediaAsset` | MediaUploaded, MediaProcessed | MediaAPI | Identity |
| **Search** | فهرسة واستعلام | `SearchIndex` (projection) | SearchIndexed | SearchAPI | يستهلك Content events |
| **Intelligence (AI)** | تصنيف/تلخيص/embeddings/ترتيب/توصية | `Proposal`, `Embedding`, `RankingModel` | ContentClassified, TagsSuggested, EmbeddingGenerated | AIGateway, RecommendationAPI | يستهلك Content+Analytics |
| **Advertising** | خانات، حملات، استهداف | `AdSlot`, `Campaign` | CampaignChanged | AdDecisionAPI | Identity, Analytics |
| **Notification** | متعدّد القنوات (push/email/…) | `Campaign`, `CampaignChannel` | NotificationRequested/Sent | NotifyAPI | يستهلك Content events |
| **Analytics** | تفاعلات وإشارات | `EngagementEvent` (stream) | EngagementRecorded | SignalsAPI | يستهلك كلّ الأحداث (read) |
| **Sports** | نتائج/جداول لحظيّة | `Fixture`, `LiveScore` | SportsEventUpdated | SportsAPI | مصادر خارجيّة |
| **Live** | بثّ لحظيّ (Reverb) | `LiveRoom`, `LiveEntry` | LiveEntryPosted | RealtimeChannel | Content, Sports |
| **Delivery (Read/BFF)** | Projections + الحافة + BFF | `ReadModel`/`ComposedDocument` | ReadModelRegenerated, CacheInvalidated | Read/BFF API | يستهلك كلّ الأحداث |

**قاعدة التكامل:** داخل السياق نداءات مباشرة؛ **بين السياقات: أحداث + Public API فقط**. `Courses (Learning)` و`Forums (Community)` سياقان **مستقبليّان منفصلان** يُشيران إلى `ContentItem`، لا يملكانه.

---

## ٣) Core Domain Model — القرار النهائيّ: `ContentItem`

**لماذا:** يوحّد الغلاف (دورة حياة/تصنيف/أعلام/مراجعات/cache-tags/بحث) **مرّة** لكلّ الأنواع؛ شرطٌ مسبق للـComposer (الـPins تشير لعقدة عامّة) وللتوصية والبحث عبر الأنواع. نمط **Arc/Ghost الهجين** (غلاف عامّ مُطبَّع + حمولات مُنمَّطة ذات رأي + كتل)، لا EAV ولا genericity بلا رأي.

**Aggregate Roots (سياق Content):**
- **`ContentItem`** (الجذر): `id, tenant_id, locale, type, status, workflow_state, slug, canonical, title, subtitle, excerpt, author_ref, primary_category_ref, published_at, flags, seo`. **يملك داخله:** `ContentBlock[]` (الجسم الكتليّ) + `Revision[]` (حدّ الاتّساق).
- **`ContentType`** (سجلّ تكوين): يعرّف الأنواع + قدرات حمولتها (article/video/podcast/reel/live/gallery/page/interactive/pdf).
- **`Taxonomy`** (Category/Tag/Topic): **جذر منفصل** — يُشار إليه بالـid.
- **`ContentRelation`** (حوافّ الرسم البيانيّ): `(from, to, relation_type)` للعلاقات **التحريريّة** (series/follow-up/translation-of/related).

**العلاقات:** `ContentItem` **يملك** blocks+revisions · **يشير** إلى Taxonomy/Author/MediaAsset (id) · **حوافّ مُنمَّطة** إلى `ContentItem` آخر · الـEditorial `Surface/Pin` **تشير** إليه.

**ما يبقى خارجه:** تعريفات التصنيف · ثنائيّات الوسائط ومعالجتها (Media) · المستخدمون (Identity) · التركيب التحريريّ (Editorial) · فهارس البحث/embeddings/ranking/توصية (Search/AI) · إشارات التفاعل (Analytics) · الإعلانات · التعليقات (سياق مرجعيّ لاحق). **العلاقات الدلاليّة المشتقّة (AI «related») = projection في AI**، لا حوافّ تحريريّة.

---

## ٤) Read Architecture — من أين تقرأ كلّ واجهة

| الواجهة | تقرأ من | الطزاجة | الحافة |
|---|---|---|---|
| **Homepage** | **Front-Page ComposedDocument** (Redis، مُولَّد حدثيًّا) | إعادة توليد مُهدَّأة عند الأحداث | edge-cached + purge؛ فتحات تخصيص على الحافة |
| **Category** | مُنسَّقة → Category ComposedDocument · الذيل الطويل → **Category Read Model** (feed مُسبَق، cursor) | حدثيّ | edge-cached + tag purge |
| **Article** | **Article Read Model** (غلاف + كتل محلولة + related، مُزال-التطبيع) | عند ContentUpdated | edge-cached + tag purge |
| **Search** | **Meilisearch index** (سياق Search) | عند SearchIndexed | — (استعلام حيّ) |
| **Live** | **قناة Reverb/WS** + Live read model خفيف (SSR shell + تحديث لحظيّ) | فوريّ (يتجاوز تأخّر الكاش) | shell على الحافة، التحديثات مباشرة |
| **Recommendation** | **AI/Reco read model** (قوائم مرشّحين، مخزن منخفض الكمون) | من Analytics signals + embeddings | تُركَّب كفتحات على الحافة/العميل |

**مبدأ:** كلّ واجهة تقرأ من **Projection مخصّص**، لا من نموذج الكتابة. **MySQL يلمسه جانب الكتابة والـProjectors فقط.**

---

## ٥) Event Architecture

| الحدث | يُصدره | المستهلكون (والفعل) |
|---|---|---|
| **ContentCreated** | Content | AI (اقتراح tags/SEO/تصنيف) · Editorial (متاح للتثبيت) · Analytics |
| **ContentPublished** | Content | Delivery (يُعيد بناء read models + invalidate + CDN purge) · Editorial (يُجدّد Surfaces المتأثّرة) · Search (فهرسة) · AI (embed/related) · Notification (عاجل/push) · Sitemap/RSS · Analytics |
| **StoryUpdated / ContentUpdated** | Content | نفس مجموعة النشر (re-index, re-embed, regenerate, invalidate) |
| **ContentUnpublished/Deleted** | Content | Search/AI (إزالة) · Editorial (**فكّ الـPins — سلامة مرجعيّة**) · Delivery (invalidate) |
| **MediaUploaded** | Media | Media (transcode/derivatives) |
| **MediaProcessed** | Media | Content (جاهزيّة) · Delivery (يُدرج الوسائط في Article read model) |
| **ContentClassified / TagsSuggested / EmbeddingGenerated** | AI | Content (يُطبَّق **بعد موافقة**) · Search/Reco (إثراء) |
| **LayoutPublished / PinChanged** | Editorial | Delivery (يُعيد بناء ComposedDocument) · CDN purge |
| **HomepageRegenerated / ReadModelRegenerated** | Delivery | CDN purge · Observability |
| **SearchIndexed** | Search | Observability · Delivery (يُعلّم «قابل للبحث») |
| **CacheInvalidated** | Delivery/Platform | Edge purge |
| **EngagementRecorded** | Analytics | AI/Reco (إشارات) · Editorial (widgets الأكثر قراءة) |
| **SportsEventUpdated** | Sports | Live (push) · Delivery (live read model) · Editorial |

**قواعد:** الأحداث **بين السياقات فقط**، مُصفوفة، idempotent، retriable؛ المستهلكون الثقال (إعادة بناء الرئيسيّة) **مُهدَّؤون/مُجمَّعون**.

---

## ٦) AI Architecture — طبقة لا ميزة (سياق Intelligence)

**الشكل الموحّد:** `input (events/content/signals) → pipeline (model عبر AIGateway) → output (Proposal بشريّ-في-الحلقة | Projection للقراءة فقط)`.

| القدرة | تعيش في | النمط |
|---|---|---|
| **التصنيف** | AI ← ContentCreated | Proposal → موافقة محرّر |
| **Tags/الكيانات** | AI | Proposal (تحريريّ) + إثراء read-side |
| **التلخيص** (excerpt/TL;DR) | AI | Proposal → موافقة → كتلة/حقل |
| **إعادة الكتابة** (عناوين/تبسيط) | AI داخل محرّر التحرير | مُساعِد، المحرّر يقبل |
| **SEO** (meta/schema) | AI عند النشر | schema تلقائيّ من الكتل + meta بموافقة |
| **Related Content** | AI (embeddings+graph) | **Projection للقراءة** (بلا بشر) |
| **Ranking** (feeds/homepage/تخصيص) | AI ranker داخل **ContentSource pipeline** (توليد مرشّحين → ترتيب) | config-driven، read-side |
| **Recommendation** (مستخدم/شريحة) | AI + Analytics signals → مخزن منخفض الكمون | فتحات على الحافة/العميل |

**أُسس إلزاميّة:** `Signal Store` (تفاعلات) · `Embedding/Vector index` (لكلّ item وكتلة) · `AIGateway` provider-agnostic (Claude افتراضيًّا) · `Human-in-the-loop` (AI **لا ينشر تلقائيًّا**). **AI يقرأ من الأحداث/الإشارات/embeddings، ويكتب كاقتراح تحريريّ أو projection للقراءة — لا يمسّ مصدر الحقيقة دون موافقة.**

---

## ٧) Deployment Architecture (رؤية ٥ سنوات)

| المكوّن | الدور | قابل للاستبدال؟ (خلف الحدّ) |
|---|---|---|
| **Laravel** | Content/Editorial/الكتابة + API + Projectors — **مونوليث معياريّ**، يُستخرج سياق لخدمة عند الحاجة | استخراج سياقات لخدمات خلف الأحداث ✅ |
| **Next.js** | Delivery/رأس الويب (SSR/ISR/**PPR**) + BFF | رأسٌ من رؤوس؛ يستهلك BFF ⇒ قابل للإضافة/الاستبدال ✅ |
| **Redis** | Projections + cache + sessions + queue | → Cluster/Dragonfly خلف واجهة الـprojection ✅ |
| **Meilisearch** | Search | → OpenSearch/Typesense خلف SearchAPI ✅ |
| **Vector store** (جديد) | embeddings للـAI | pgvector/Qdrant خلف AIGateway ✅ |
| **Workers** | مستهلكو الطوابير (projectors/media/AI/notify/index) | أفقيّ ✅ |
| **Queue/Bus** | Redis الآن | → SQS/RabbitMQ/**Kafka + Debezium CDC** خلف تجريد الحدث ✅ |
| **CDN/Edge** | Cloudflare: كاش HTML/API + **Edge compute** (تخصيص/تركيب) | ✅ |
| **Storage** | R2 (وسائط) · MySQL (مصدر الحقيقة) · نسخ احتياط | R2 ✅ · MySQL **الأصعب (شبه أحاديّ)** |
| **Scheduler** | دوريّات (projections/sitemap/digests) | ✅ |
| **Real-time** | Reverb/WS (Live/Sports) | خلف RealtimeChannel ✅ |
| **Monitoring** | OpenTelemetry: logs/metrics/traces + **تتبّع تدفّق الأحداث** + SLO لكلّ سياق | ✅ |

**قرار التعدّديّة (أحسمه):** `tenant` في البيانات **منذ اليوم**؛ نشرٌ **معزول لكلّ عميل الآن** (عملاء premium قلائل)، والنموذج **جاهز للدمج multi-tenant** عند تجاوز عتبة (>~١٠ عملاء صغار). **الأصعب استبدالاً: MySQL كمصدر حقيقة والـtenancy** ⇒ يُحسمان الآن.

---

## ٨) Evolution Roadmap

| المرحلة | لماذا | ما يتغيّر | ما يبقى ثابتًا |
|---|---|---|---|
| **٠ (تمّت)** | إزالة عنق COUNT | cursor pagination | كلّ شيء |
| **١ — Read Plane + Events** | مقياس القراءة + فكّ الاقتران | رسمنة Domain Events (تغليف الأمريّ) · Projections (Home/Category/Article) خلف flags+fallback · edge-cache + CDN purge · PPR/streaming · حمولات نحيفة | نموذج Article · الأدمن · الروابط |
| **٢ — `ContentItem` Core** | نواة المنصّة | `ContentItem`+`ContentType`+كتل خلف Repository · الأنواع الجديدة (فيديو/بودكاست/ريلز) تولد عليه · ترحيل المقال تدريجيًّا (adapter) | عقود القراءة العامّة · الروابط |
| **٣ — Editorial Composer** | تحكّم رئيس التحرير | Surfaces/Layouts/Pins للرئيسيّة+الأقسام الكبرى · الذيل بقوالب · الأعلام الحاليّة = قالب افتراضيّ (جسر) | Read Plane · `ContentItem` |
| **٤ — Intelligence** | AI أصيل | Signal Store + Vector + اقتراحات (تصنيف/tags/SEO/تلخيص) بشريّ-في-الحلقة · related projection · AI ranking في المصادر | كلّ شيء (AI يتّصل بالأحداث/المصادر) |
| **٥ — Scale & Personalization & Contexts** | منصّة عالميّة | تخصيص على الحافة + Reco · Live/Sports لحظيّ · تنفيذ قرار الـtenancy · سياقات جديدة (Learning/Community) كخدمات تُشير لـ`ContentItem` | العقود · الأحداث · `ContentItem` |

**كلّ مرحلة إضافيّة، خلف حدود/flags، غير كاسرة. الترتيب مقصود:** أحداث ⟶ نواة ⟶ تحرير ⟶ ذكاء ⟶ مقياس.

**ملاحظة (بعد اكتمال Phase 1 execution):** Phase 1 (خارطة التنفيذ اليوميّة —
راجع `PHASE1-PROGRESS.md`) هي الخطوة الأولى الفعليّة داخل **Stage 1** أعلاه
(Read Plane + Events) — بدأت بعمود الأحداث (`ArticleStatusChanged` وما
تلاه) قبل الانتقال لأيّ عمل Projection/Read-Model حقيقيّ، وأضافت أيضًا
بعض التأسيس المبكر لِـStage 2 (سجلّ `entities` القابل لإعادة الاستخدام
من `ContentItem` لاحقًا) وStage 5 (عمود `tenant_id` المحجوز) — كلاهما
بلا كسر لتسلسل المراحل، لأنّهما إضافيّان بالكامل ولم يُفعَّلا بعد.

---

## ٩) Architectural Decisions (ADR)

القرارات المفصَّلة أدناه مسجَّلة كملفّات منفصلة تحت `docs/adr/` (رقم كلّ
قرار يطابق اسم ملفّه، مثلاً `docs/adr/005-tenant-locale-first-class.md`):

- **ADR-001** — النواة `ContentItem` عامّة (Arc/Ghost هجين).
- **ADR-002** — جسمٌ كتليّ مُنظَّم؛ `content_html` ليس مصدر حقيقة.
- **ADR-003** — CQRS-lite: قراءة من Projections، MySQL مصدر حقيقة، لا Event-Sourcing.
- **ADR-004** — عمود حدثيّ بين السياقات (مُصفوف/idempotent/مُهدَّأ).
- **ADR-005** — `tenant + locale` هويّة من الدرجة الأولى؛ نشر معزول الآن، جاهز multi-tenant لاحقًا.
- **ADR-006** — التحرير بيانات؛ الرئيسيّة ComposedDocument لا fan-out رندر.
- **ADR-007** — توزيع من الحافة؛ PPR؛ التخصيص على الحافة لا داخل كاش الصفحة.
- **ADR-008** — سياقات محدودة بعقود+أحداث؛ لا وصول قاعدة عابر.
- **ADR-009** — AI طبقة: اقتراحات بشريّ-في-الحلقة للكتابة، projections للقراءة، gateway محايد، لا نشر تلقائيّ.
- **ADR-010** — Search/Reco/Related projections في سياقاتها، تُستعلَم عبر APIها.
- **ADR-011** — Courses/Forums سياقان منفصلان يُشيران لـ`ContentItem`، لا أنواعه.
- **ADR-012** — ترحيل تدريجيّ خلف Repository؛ لا big-bang.
- **ADR-013** — عقود API مُصدَّرة (ComposedDocument/Content) لرؤوس متعدّدة.
- **ADR-014** — مونوليث معياريّ (Laravel) الآن؛ استخراج خدمات عند الحاجة خلف الأحداث.
- **ADR-015** — مسار لحظيّ (Reverb/WS) للـLive/العاجل يتجاوز تأخّر الكاش.
- **ADR-016** — بنية قابلة للاستبدال خلف حدود (محرّك بحث/طابور-bus/مخزن كاش/مزوّد نموذج).

بالإضافة إلى سلسلة `E{n}` — قرارات **تنفيذيّة** اتُّخذت أثناء Phase 1
نفسها (تفصيليّة أكثر، أضيق نطاقاً)، مثل
[`E1`](../adr/E1-defer-content-item-unification.md) (تأجيل توحيد
`ContentItem` لحين Stage 2) و[`E2`](../adr/E2-domain-events-wrap-not-replace.md)
(أوّل حدث نطاقيّ حقيقيّ) — راجع فهرس `docs/adr/` الكامل.

---

**هذا المرجع الرسميّ.** المسار العمليّ التالي دون نقاش نظريّ: **المرحلة ١
(Read Plane + Events)** — أُنتج لها مخطّط المكوّنات، عقود الأحداث، وواجهات
الـProjections وأهداف SLO. جاهز للبدء متى أذنت.
