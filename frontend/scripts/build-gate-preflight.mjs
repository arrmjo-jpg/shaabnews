// بوّابة 2 — فحص اتصال فعليّ بالـ CMS قبل البناء.
//
// بوّابة الإعدادات تثبت أنّ العنوان *مضبوط*؛ هذه تثبت أنّه *يستجيب ببيانات*. الفشل هنا يعطي
// تشخيصاً مباشراً (العنوان + رمز الحالة) بدل بناء يستغرق دقيقتين ثمّ يسقط عند فحص المخرجات.

import { PREFLIGHT_ENDPOINTS } from './critical-routes.mjs';

// Deploy-verification marker (temporary — see the investigation that added this): if this line
// is absent from a Coolify build log, Coolify is not building this commit, full stop.
console.error('==================================================');
console.error('BUILD-GATE-PREFLIGHT VERSION: de6aafa');
console.error('==================================================');

const base = (process.env.BUILD_API_BASE_URL ?? '').replace(/\/$/, '');
const headers = process.env.INTERNAL_API_TOKEN
  ? { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }
  : undefined;

const TIMEOUT_MS = 15000;
const failures = [];

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

for (const ep of PREFLIGHT_ENDPOINTS) {
  const url = `${base}${ep.path}`;
  console.log(`GET ${url}`);

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    // undici collapses the real cause (TLS, DNS, ECONNREFUSED, ...) into a generic
    // "fetch failed" err.message — the actual reason lives in err.cause.
    const reason = err?.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS}ms` : err?.message;
    failures.push(`${ep.label}: ${reason} — ${url}`);
    console.error(`  error.message: ${err?.message}`);
    console.error(`  error.cause: ${err?.cause?.message ?? '(none)'}`);
    console.error(`  error.stack:\n${err?.stack}`);
    continue;
  }

  const contentType = res.headers.get('content-type') ?? '(none)';
  console.log(`  status: ${res.status} ${res.statusText}`);
  console.log(`  content-type: ${contentType}`);
  console.log('  headers:');
  for (const [key, value] of res.headers.entries()) console.log(`    ${key}: ${value}`);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '(failed to read body)');
    failures.push(`${ep.label}: HTTP ${res.status} ${res.statusText} — ${url}`);
    console.error(`  NOT OK — url: ${url}`);
    console.error(`  status: ${res.status} ${res.statusText}`);
    console.error(`  body (first 1000 chars):\n${bodyText.slice(0, 1000)}`);
    continue;
  }

  const rawText = await res.text();
  let body;
  try {
    body = JSON.parse(rawText);
  } catch (err) {
    failures.push(`${ep.label}: invalid JSON — ${url}`);
    console.error(`  raw body:\n${rawText}`);
    console.error(`  parse error: ${err.message}`);
    continue;
  }

  if (ep.arrayPath) {
    const arr = at(body, ep.arrayPath);
    if (!Array.isArray(arr)) {
      failures.push(`${ep.label}: expected array at "${ep.arrayPath}" — ${url}`);
      console.error(`  body:\n${JSON.stringify(body, null, 2)}`);
    } else if (arr.length === 0) {
      // 200 بقائمة فارغة هو بالضبط السيناريو الذي يُنتج صفحة موسومة لكن بلا محتوى — عدا فيديوهات:
      // فارغة شرعًا حين لا يوجد فيديو منشور بعد، فتُسقط البناء ظلمًا. تحذير فقط لهذه الحالة تحديدًا؛
      // الفشل يبقى قائمًا لها في كل الحالات الأخرى (لا استجابة، 500، JSON غير صالح).
      const emptyMsg = `${ep.label}: HTTP 200 but "${ep.arrayPath}" is empty — ${url}`;
      if (ep.label === 'videos feed') {
        console.warn(`[build-gate:preflight] WARNING — ${emptyMsg}`);
      } else {
        failures.push(emptyMsg);
        console.error(`  body:\n${JSON.stringify(body, null, 2)}`);
      }
    } else {
      console.log(`[build-gate:preflight] OK — ${ep.label} (${arr.length} item(s))`);
    }
  } else {
    const data = body?.data ?? body;
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      failures.push(`${ep.label}: HTTP 200 but payload is empty — ${url}`);
      console.error(`  body:\n${JSON.stringify(body, null, 2)}`);
    } else {
      console.log(`[build-gate:preflight] OK — ${ep.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error('\n[build-gate:preflight] FAIL — the CMS is not returning usable data for the build:\n');
  for (const f of failures) console.error(`  • ${f}`);
  console.error(
    '\n  A build cannot prerender pages it has no data for. Prerendering anyway would bake empty\n' +
      '  HTML into the image with no cache tags attached, which revalidateTag() can never repair.\n' +
      '  Ensure the backend is deployed and reachable at BUILD_API_BASE_URL before building.\n',
  );
  process.exit(1);
}

console.log('[build-gate:preflight] OK — all critical endpoints returned data');
