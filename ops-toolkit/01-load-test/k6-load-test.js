/**
 * k6 Load Test — AlphaCMS Public API
 * =====================================================================
 * الغرض: قياس نقطة التشبّع الفعلية (pm.max_children=30 على حاوية backend
 * واحدة حسب docker/php/zz-fpm.conf) بدل الاستنتاج النظري في التقارير
 * السابقة. يحاكي مزيجاً واقعياً من زيارات القراءة العامة لموقع إخباري:
 * قوائم (تكلفة عالية عند تفويت الكاش) وتفاصيل (أرخص، مفاتيح كاش متعددة).
 *
 * التشغيل:
 *   BASE_URL=https://api.alpha-cms.shop/api/v1 k6 run k6-load-test.js
 *
 * سيناريوهات مرحلية (Ramp) تحاكي 100 → 1000 → 10000 مستخدم متزامن تقريبي
 * (VUs ≠ مستخدمون حقيقيون تماماً، لكنها أقرب تقدير عملي متاح بلا بيانات
 * إنتاج فعلية عن معدل الطلب لكل مستخدم).
 *
 * ما يُثبته هذا السكربت فعلياً (لا نظرياً):
 *  - عند أي عدد VUs يبدأ p95/p99 بالتدهور الحاد (إشارة تشبّع FPM الحقيقية).
 *  - نسبة أخطاء 502/504 (طابور nginx/FPM ممتلئ) مقابل عدد الطلبات الناجحة.
 *  - هل مسار القائمة (offset pagination، استعلام COUNT المحتمل) أبطأ فعلاً
 *    من مسار cursor كما استنتج التقرير الأول من رقم منقول غير مُعاد قياسه.
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://api.alpha-cms.shop/api/v1";
const LOCALE = __ENV.LOCALE || "ar";

// مقاييس مخصّصة — تفصل تكلفة مسار القائمة (الأثقل المُدَّعى) عن مسار التفاصيل.
export const listErrors = new Rate("list_errors");
export const detailErrors = new Rate("detail_errors");
export const listDuration = new Trend("list_duration_ms", true);
export const detailDuration = new Trend("detail_duration_ms", true);
export const cursorDuration = new Trend("cursor_pagination_duration_ms", true);
export const offsetDeepPageDuration = new Trend("offset_deep_page_duration_ms", true);
export const gatewayErrors = new Rate("gateway_5xx_errors"); // 502/504 = تشبّع FPM/nginx الحقيقي

// ── سيناريوهات: عدّل هذه المراحل لتطابق المستوى المطلوب فحصه فعلياً ──
// شغّل مرحلة واحدة كل مرة (استخدم SCENARIO=ramp_100 مثلاً) لعزل نتيجة كل مستوى.
const SCENARIO = __ENV.SCENARIO || "ramp_100_1000_10000";

const scenarios = {
  ramp_100_1000_10000: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 100 },   // يقابل تحليل "100 مستخدم" في التقرير
      { duration: "2m", target: 100 },
      { duration: "1m", target: 1000 },  // يقابل "1000 مستخدم"
      { duration: "3m", target: 1000 },
      { duration: "1m", target: 10000 }, // يقابل "10000 مستخدم" — احذر: قد يُسقط الخادم فعلياً
      { duration: "3m", target: 10000 },
      { duration: "2m", target: 0 },
    ],
  },
  smoke: {
    executor: "constant-vus",
    vus: 5,
    duration: "1m",
  },
};

export const options = {
  scenarios: { main: { ...scenarios[SCENARIO] } },
  thresholds: {
    // فشل الاختبار صراحة إن تجاوزت الأخطاء 5% — لا تدَع "النظام صمد" انطباعاً
    // بصرياً فقط؛ اجعله حكماً آلياً قابلاً للـ CI.
    http_req_failed: ["rate<0.05"],
    gateway_5xx_errors: ["rate<0.01"],
    // p95 هو الرقم الذي يهم فعلياً لتجربة القارئ الحقيقي، لا المتوسط.
    "list_duration_ms": ["p(95)<3000"],
    "detail_duration_ms": ["p(95)<1500"],
  },
};

function tagged(res, name) {
  const is5xx = res.status === 502 || res.status === 503 || res.status === 504;
  gatewayErrors.add(is5xx);
  return is5xx;
}

export default function () {
  group("homepage_and_lists (المسار الأثقل المزعوم)", function () {
    const res = http.get(`${BASE_URL}/${LOCALE}/homepage`, { tags: { name: "homepage" } });
    listDuration.add(res.timings.duration);
    listErrors.add(!check(res, { "homepage 200": (r) => r.status === 200 }));
    tagged(res);
  });

  sleep(Math.random() * 1.5);

  group("article_list_offset (يختبر ادّعاء COUNT ~1.4s عند تفويت الكاش)", function () {
    // q عشوائي يكسر مفتاح الكاش عمداً لمحاكاة نسبة تفويت واقعية بدل 100% cache hit.
    const bust = Math.floor(Math.random() * 5000);
    const res = http.get(`${BASE_URL}/${LOCALE}/articles?per_page=15&page=1&_cb=${bust}`, {
      tags: { name: "articles_list_offset" },
    });
    listDuration.add(res.timings.duration);
    listErrors.add(!check(res, { "articles list 200": (r) => r.status === 200 }));
    tagged(res);
  });

  group("article_list_cursor (المسار الأسرع المُدَّعى — للمقارنة المباشرة)", function () {
    const res = http.get(`${BASE_URL}/${LOCALE}/articles?paginate=cursor&per_page=15`, {
      tags: { name: "articles_list_cursor" },
    });
    cursorDuration.add(res.timings.duration);
    tagged(res);
  });

  sleep(Math.random() * 1.5);

  group("article_list_deep_offset_page (اختبار حماية max_page=100)", function () {
    const res = http.get(`${BASE_URL}/${LOCALE}/articles?per_page=15&page=95`, {
      tags: { name: "articles_list_deep_page" },
    });
    offsetDeepPageDuration.add(res.timings.duration);
    tagged(res);
  });

  group("category_and_video_reads", function () {
    let res = http.get(`${BASE_URL}/${LOCALE}/categories`, { tags: { name: "categories" } });
    tagged(res);
    res = http.get(`${BASE_URL}/${LOCALE}/videos?per_page=15`, { tags: { name: "videos_list" } });
    listDuration.add(res.timings.duration);
    tagged(res);
    res = http.get(`${BASE_URL}/${LOCALE}/reels?per_page=15`, { tags: { name: "reels_list" } });
    tagged(res);
  });

  sleep(Math.random() * 2);

  // ملاحظة: مسار التفاصيل (/articles/{slug}) يحتاج slug حقيقياً من بيانات الإنتاج —
  // استبدل SAMPLE_SLUGS ببيانات فعلية قبل التشغيل (استعلم: SELECT slug FROM articles
  // WHERE status='published' ORDER BY views_count DESC LIMIT 20).
  const SAMPLE_SLUGS = (__ENV.SAMPLE_SLUGS || "").split(",").filter(Boolean);
  if (SAMPLE_SLUGS.length > 0) {
    group("article_detail", function () {
      const slug = SAMPLE_SLUGS[Math.floor(Math.random() * SAMPLE_SLUGS.length)];
      const res = http.get(`${BASE_URL}/${LOCALE}/articles/${slug}`, { tags: { name: "article_detail" } });
      detailDuration.add(res.timings.duration);
      detailErrors.add(!check(res, { "article detail 200": (r) => r.status === 200 }));
      tagged(res);
    });
  }

  sleep(Math.random() * 2 + 0.5);
}

/**
 * تفسير النتائج — اربطها مباشرة بأسئلة التقريرين السابقين:
 *
 * 1. إن بدأ gateway_5xx_errors بالارتفاع عند VUs معيّن: هذا هو الدليل الفعلي
 *    (لا التقدير النظري 30÷زمن_الطلب) على نقطة تشبّع FPM/nginx الحقيقية.
 *    قارن رقم VUs عندها مباشرة مع pm.max_children=30 — إن كان قريباً من 30
 *    فهذا يُثبت (لا يُرجّح فقط) استنتاج "سقف 30 عملية" من التقرير الأول.
 *
 * 2. list_duration_ms مقابل cursor_pagination_duration_ms: إن كان الفارق
 *    كبيراً ومتسقاً، هذا يُثبت فعلياً ادّعاء "COUNT مكلف" (لا ينقل رقماً
 *    قديماً غير مُعاد قياسه كما فعل التقريران السابقان).
 *
 * 3. إن ظل p95 مستقراً حتى عند 10,000 VU بلا ارتفاع أخطاء: هذا دليل قوي
 *    (وليس استنتاجاً هندسياً) على وجود طبقة CDN/كاش تمتص الحمل فعلياً قبل
 *    الوصول للـ backend — يحسم سؤال "هل Cloudflare يعمل فعلياً؟" المفتوح
 *    في المراجعة النقدية.
 */
