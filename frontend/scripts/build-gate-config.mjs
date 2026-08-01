// بوّابة 1 — تحقّق الإعدادات قبل البناء. تفشل خلال ثوانٍ على خطأ ضبط، قبل إهدار دقائق بناء.
//
// الخلفية: صفحات ISR تُولَّد وقت البناء. إن كانت API_BASE_URL فارغة أو غير صالحة، تُفعَّل حراسات
// `if (!env.apiBaseUrl) return []` في كلّ lib/*، فتُخبَز صفحات فارغة في الصورة **دون أن يفشل
// البناء** ودون أن تُرفَق بها وسوم كاش — وعندها لا يستطيع revalidateTag() إصلاحها أبداً.

const fail = (msg) => {
  console.error(`\n[build-gate:config] FAIL — ${msg}\n`);
  process.exit(1);
};
const warn = (msg) => console.warn(`[build-gate:config] WARN — ${msg}`);

const buildApi = process.env.BUILD_API_BASE_URL ?? '';
const apiBase = process.env.API_BASE_URL ?? '';
const siteUrl = process.env.SITE_URL ?? '';

if (!buildApi) {
  fail(
    'BUILD_API_BASE_URL is not set.\n' +
      '  It must point at a CMS endpoint reachable *from inside the build*.\n' +
      '  Local:   http://host.docker.internal:8080\n' +
      '  Coolify: the public API URL (https://...)\n' +
      '  CI:      a backend service in the pipeline, or a reachable public URL',
  );
}

let parsed;
try {
  parsed = new URL(buildApi);
} catch {
  fail(`BUILD_API_BASE_URL is not a valid absolute URL: "${buildApi}"`);
}
if (!/^https?:$/.test(parsed.protocol)) fail(`BUILD_API_BASE_URL must be http(s), got "${parsed.protocol}"`);

// http://backend هو اسم خدمة Compose — يُحلّ وقت التشغيل فقط. BuildKit ينفّذ البناء خارج تلك
// الشبكة، فتمريره هنا يعني فشل كلّ جلب ثمّ صفحات فارغة. أوقفه صراحةً مع رسالة تشرح السبب.
if (/^(backend|localhost|127\.0\.0\.1)$/.test(parsed.hostname) && parsed.hostname === 'backend') {
  fail(
    'BUILD_API_BASE_URL points at "http://backend", which is the *runtime* Compose service name.\n' +
      '  Docker builds run off the Compose network and cannot resolve it.\n' +
      '  Use a build-reachable endpoint instead (see .env.example).',
  );
}

// داخل الحاوية يُشتقّ API_BASE_URL من BUILD_API_BASE_URL؛ اختلافهما يعني تسرّب قيمة وقت التشغيل.
if (apiBase !== buildApi) {
  fail(
    `API_BASE_URL ("${apiBase}") does not match BUILD_API_BASE_URL ("${buildApi}").\n` +
      '  Inside the build these must be identical — the Dockerfile derives one from the other.',
  );
}

if (!siteUrl) fail('SITE_URL is not set. It is baked into canonical/og:url of every prerendered page.');
try {
  const s = new URL(siteUrl);
  // الأصل المحليّ صالح للتطوير لكنّه كارثة SEO إن وصل الإنتاج — أخبز البوّابة الصارمة في CI/Coolify.
  if (/^(localhost|127\.0\.0\.1)$/.test(s.hostname)) {
    if (process.env.BUILD_STRICT_PUBLIC_URL === '1') {
      fail(`SITE_URL is "${siteUrl}" but BUILD_STRICT_PUBLIC_URL=1 — production builds need the public origin.`);
    }
    warn(`SITE_URL is "${siteUrl}" — fine locally, but canonical/og:url would ship wrong in production.`);
  }
} catch {
  fail(`SITE_URL is not a valid absolute URL: "${siteUrl}"`);
}

// OPENWEATHER_API_KEY يصل عبر BuildKit secret mount؛ /weather ضمن الصفحات الحرجة، فغيابه
// يُنتج صفحة طقس فارغة تُسقطها البوّابة 3 لاحقاً — أوقفه هنا برسالة أوضح وأبكر.
if (!process.env.OPENWEATHER_API_KEY) {
  fail(
    'OPENWEATHER_API_KEY is empty inside the build.\n' +
      '  It is delivered via a BuildKit secret mount (never a build arg).\n' +
      '  Check that OPENWEATHER_API_KEY is set in .env and that the build was run through docker compose.',
  );
}

console.log(
  `[build-gate:config] OK — build endpoint ${parsed.origin}, site ${siteUrl}, secrets present`,
);
