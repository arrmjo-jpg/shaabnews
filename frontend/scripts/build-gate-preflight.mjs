// بوّابة 2 — فحص اتصال فعليّ بالـ CMS قبل البناء.
//
// بوّابة الإعدادات تثبت أنّ العنوان *مضبوط*؛ هذه تثبت أنّه *يستجيب ببيانات*. الفشل هنا يعطي
// تشخيصاً مباشراً (العنوان + رمز الحالة) بدل بناء يستغرق دقيقتين ثمّ يسقط عند فحص المخرجات.

import { PREFLIGHT_ENDPOINTS } from './critical-routes.mjs';

const base = (process.env.BUILD_API_BASE_URL ?? '').replace(/\/$/, '');
const headers = process.env.INTERNAL_API_TOKEN
  ? { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }
  : undefined;

const TIMEOUT_MS = 15000;
const failures = [];

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

for (const ep of PREFLIGHT_ENDPOINTS) {
  const url = `${base}${ep.path}`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      failures.push(`${ep.label}: HTTP ${res.status} ${res.statusText} — ${url}`);
      continue;
    }
    const body = await res.json();
    if (ep.arrayPath) {
      const arr = at(body, ep.arrayPath);
      if (!Array.isArray(arr)) {
        failures.push(`${ep.label}: expected array at "${ep.arrayPath}" — ${url}`);
      } else if (arr.length === 0) {
        // 200 بقائمة فارغة هو بالضبط السيناريو الذي يُنتج صفحة موسومة لكن بلا محتوى.
        failures.push(`${ep.label}: HTTP 200 but "${ep.arrayPath}" is empty — ${url}`);
      } else {
        console.log(`[build-gate:preflight] OK — ${ep.label} (${arr.length} item(s))`);
      }
    } else {
      const data = body?.data ?? body;
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        failures.push(`${ep.label}: HTTP 200 but payload is empty — ${url}`);
      } else {
        console.log(`[build-gate:preflight] OK — ${ep.label}`);
      }
    }
  } catch (err) {
    failures.push(`${ep.label}: ${err?.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS}ms` : err?.message} — ${url}`);
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
