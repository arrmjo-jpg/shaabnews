// قائمة الصفحات الحرجة المشتركة بين بوّابتَي ما قبل البناء وما بعده.
//
// لماذا توجد أصلاً: كلّ جالبات البيانات في lib/* تبتلع الأخطاء (`catch { return [] }`)، فالبناء
// «ينجح» وهو يُنتج صفحات فارغة. الوسوم وحدها لا تكفي دليلاً — قد تُسجَّل الوسوم بينما تكون
// الاستجابة 200 بقائمة فارغة أو يفشل التحليل جزئيّاً — لذلك لكلّ صفحة ذات بيانات متوقَّعة شرطان:
// وسم تطبيقيّ فعليّ **و** محتوى حقيقيّ في الـ HTML المولَّد.
//
// حدود `min` مُعايَرة على مخرجات بناء حقيقيّ ناجح (لا تخمين)، ومضبوطة أدنى بكثير من المقيس
// كي لا تهتزّ مع تغيّر المحتوى: الرئيسة 131 رابطاً · الأحدث 33 · الرائج 33 · الاقتصاد 27 ·
// البورصة 12 رقماً عشريّاً · الفيديو 34 رابطاً · الريلز 11 · الطقس 214 علامة درجة · العدد 2.
//
// ملاحظة على النمط: React SSR يفصل القيمة المُحقَنة عن النصّ الثابت بتعليق HTML، فـ `{temp}°`
// تُخرَج `20<!-- -->°` — لذلك تسمح أنماط الأرقام بهذا الفاصل صراحةً.
//
// file: اسم الملف داخل .next/server/app — مجموعات المسارات (site)/(reels) تُحذف من المسار المسطّح.
// requireTags: وسوم تطبيقيّة يجب وجودها بالاسم. minAppTags: حدّ أدنى لأيّ وسم غير _N_T_/*.
// content: أنماط يجب أن تتحقّق بحدّ أدنى. forbid: علامات «لا توجد بيانات» يجب ألّا تظهر.
//
// أقسام قد تفرغ شرعاً (لا بثّ مباشر الآن مثلاً) تُفحص بالوسوم فقط — إسقاط البناء لأنّ قسماً
// لا يحوي محتوى بعدُ سيكون إنذاراً كاذباً يعطّل النشر.

const ARTICLE_LINKS = /href="\/news\/\d{2}\/\d{2}\/\d{4}\//g;

export const CRITICAL_ROUTES = [
  {
    route: '/',
    file: 'index',
    requireTags: ['site-settings', 'categories', 'page-feed:ar'],
    content: [{ label: 'article links', pattern: ARTICLE_LINKS, min: 20 }],
  },
  {
    route: '/news/videos',
    file: 'news/videos',
    requireTags: ['video-feed:ar'],
    // الروابط تأتي من canonical_path في الباك إند (‎/videos/{idslug}‎)؛ يُقبل الشكلان كي لا
    // تنكسر البوّابة إن حُدِّث الباك إند لاحقاً إلى ‎/news/videos/‎.
    content: [{ label: 'video links', pattern: /href="\/(?:news\/)?videos\/[^"]+"/g, min: 5 }],
    forbid: ['لا توجد فيديوهات حالياً'],
  },
  {
    route: '/reels',
    file: 'reels',
    requireTags: ['reel-feed:ar'],
    content: [{ label: 'reel references', pattern: /\/reels\/[A-Za-z0-9\-_]+/g, min: 3 }],
    forbid: ['لا توجد ريلز بعد'],
  },
  {
    route: '/weather',
    file: 'weather',
    requireTags: ['weather'],
    content: [{ label: 'temperature readings', pattern: /\d+(?:<!-- -->)?\s*°/g, min: 10 }],
  },
  {
    route: '/login',
    file: 'login',
    requireTags: ['recaptcha-config'],
    content: [{ label: 'recaptcha wiring', pattern: /recaptcha/gi, min: 1 }],
  },
  {
    route: '/latest',
    file: 'latest',
    requireTags: ['feed:latest'],
    content: [{ label: 'article links', pattern: ARTICLE_LINKS, min: 10 }],
  },
  {
    route: '/trending',
    file: 'trending',
    requireTags: ['feed:most_read'],
    content: [{ label: 'article links', pattern: ARTICLE_LINKS, min: 10 }],
  },
  {
    route: '/economy',
    file: 'economy',
    requireTags: ['articles'],
    content: [{ label: 'article links', pattern: ARTICLE_LINKS, min: 10 }],
  },
  {
    route: '/bourse',
    file: 'bourse',
    requireTags: ['ase-index', 'ase-summary'],
    content: [{ label: 'market figures', pattern: />[0-9]{1,3},?[0-9]*\.[0-9]{1,2}</g, min: 5 }],
  },
  {
    route: '/epaper',
    file: 'epaper',
    requireTags: ['epaper-feed:ar'],
    content: [{ label: 'issue links', pattern: /href="\/newspaper\/[^"]+"/g, min: 1 }],
  },
  {
    // البثّ المباشر قد يكون فارغاً شرعاً (لا بثّ الآن) ⇒ فحص الوسم فقط، بلا شرط محتوى.
    route: '/news/live',
    file: 'news/live',
    requireTags: ['broadcast-feed:live'],
  },
];

// نقاط الـ API التي تفحصها بوّابة ما قبل البناء. `arrayPath` = مسار المصفوفة التي يجب ألّا تكون
// فارغة؛ غيابه يعني أنّ وجود كائن `data` غير فارغ كافٍ.
export const PREFLIGHT_ENDPOINTS = [
  { label: 'site settings', path: '/api/v1/site?locale=ar' },
  { label: 'categories', path: '/api/v1/ar/categories', arrayPath: 'data' },
  { label: 'videos feed', path: '/api/v1/ar/videos?per_page=1', arrayPath: 'data' },
  { label: 'reels feed', path: '/api/v1/ar/reels?paginate=cursor&per_page=1', arrayPath: 'data' },
];
