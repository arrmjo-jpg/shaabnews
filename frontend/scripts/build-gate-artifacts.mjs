// بوّابة 3 — فحص المخرجات بعد البناء. هذه هي الضمانة الفعليّة.
//
// البوّابتان 1 و2 قد تنجحان بينما يفشل جالب واحد بصمت (مهلة، 500 على نقطة واحدة، فشل تحليل zod)
// فيبتلع `catch { return [] }` الخطأ وتُخبَز صفحة فارغة. الدليل الوحيد القاطع هو المخرجات نفسها.
//
// شرطان لكلّ صفحة حرجة — والثاني ضروريّ لأنّ الوسوم قد تُسجَّل ومع ذلك تكون البيانات فارغة:
//   1. وسوم كاش تطبيقيّة (أيّ وسم لا يبدأ بـ _N_T_/) — بدونها لا يصل إليها revalidateTag() أبداً.
//   2. محتوى حقيقيّ داخل الـ HTML المولَّد، وغياب علامات «لا توجد بيانات».

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CRITICAL_ROUTES } from './critical-routes.mjs';

const APP_DIR = join(process.cwd(), '.next', 'server', 'app');
const INTERNAL_TAG_PREFIX = '_N_T_/';

const failures = [];
const report = [];

for (const spec of CRITICAL_ROUTES) {
  const metaPath = join(APP_DIR, `${spec.file}.meta`);
  const htmlPath = join(APP_DIR, `${spec.file}.html`);
  const problems = [];

  if (!existsSync(metaPath) || !existsSync(htmlPath)) {
    // غياب المخرجات يعني أنّ المسار لم يعد مُولَّداً مسبقاً — تغيّر معماريّ لا يمرّ صامتاً.
    failures.push(`${spec.route}: no prerendered artifact (expected ${spec.file}.html/.meta)`);
    report.push({ route: spec.route, tags: '—', content: 'MISSING', ok: false });
    continue;
  }

  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const allTags = (meta?.headers?.['x-next-cache-tags'] ?? '').split(',').filter(Boolean);
  const appTags = allTags.filter((t) => !t.startsWith(INTERNAL_TAG_PREFIX));

  for (const required of spec.requireTags ?? []) {
    if (!appTags.includes(required)) problems.push(`missing cache tag "${required}"`);
  }
  const minAppTags = spec.minAppTags ?? (spec.requireTags?.length ? 1 : 1);
  if (appTags.length < minAppTags) {
    problems.push(`only ${appTags.length} application cache tag(s), expected >= ${minAppTags}`);
  }

  const html = readFileSync(htmlPath, 'utf8');
  const contentBits = [];

  for (const check of spec.content ?? []) {
    const count = (html.match(check.pattern) ?? []).length;
    contentBits.push(`${check.label}=${count}`);
    if (count < check.min) problems.push(`${check.label}: found ${count}, expected >= ${check.min}`);
  }
  for (const marker of spec.forbid ?? []) {
    if (html.includes(marker)) problems.push(`empty-state marker present: "${marker}"`);
  }

  report.push({
    route: spec.route,
    tags: appTags.length ? appTags.join(' ') : '(none)',
    content: contentBits.length ? contentBits.join(' ') : '—',
    ok: problems.length === 0,
  });
  for (const p of problems) failures.push(`${spec.route}: ${p}`);
}

console.log('\n[build-gate:artifacts] prerendered critical routes\n');
for (const r of report) {
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.route.padEnd(16)} ${r.content.padEnd(28)} tags: ${r.tags}`);
}

if (failures.length > 0) {
  console.error('\n[build-gate:artifacts] FAIL — prerendered pages are incomplete:\n');
  for (const f of failures) console.error(`  • ${f}`);
  console.error(
    '\n  These artifacts would ship as the cached truth for this deployment. Pages missing their\n' +
      '  application cache tags cannot be repaired by revalidateTag() at all, and pages with tags\n' +
      '  but no content would serve an empty page until their ISR window expires.\n',
  );
  process.exit(1);
}

console.log('\n[build-gate:artifacts] OK — every critical route has cache tags and real content\n');
