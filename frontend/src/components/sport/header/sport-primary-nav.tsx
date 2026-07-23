import Link from 'next/link';
import { getCategoryById } from '@/lib/feed';
import { SportSectionsDropdown, type ResolvedSportMenuNode } from '@/components/sport/header/sport-sections-dropdown';
import { getSportMenu, type SportMenuItemNode } from '@/lib/sport-menu';

// Sprint 1 Commit 5 — «الأقسام» أصبحت قائمة منسدلة حقيقية مربوطة بـ /api/v1/sport-menu (Commit 4).
// نداء getSportMenu() هنا مباشرةً (لا رفعه لـ SportHeader قسرًا) — نفس النمط المعتمد صراحةً في
// مراجعة Commit 3: أيّ Server Component يحتاج بيانات مصدرها ملفوف بـ React.cache() يستدعيها
// مباشرةً، والفصل بين المسؤوليات هو ما يقرّر أين يُجلَب لا الخوف من تكرار وهميّ. مخفيّ على الموبايل
// (< md) لأنّ MobileBottomNav يغطّي التنقّل الأساسيّ هناك — لم يتغيّر.
//
// Sprint 1.6 Phase 3.2 (Mega Menu، القرار المعماري في project_sport_header_footer_analysis):
// حلّ category_id → href ينتقل إلى هنا (Server) لا SportSectionsDropdown (Client) — getCategoryById
// خادميّة (server-only) وغير متزامنة، لا يمكن استدعاؤها من مكوّن عميل مباشرة. النتيجة: شجرة مُحلَّلة
// جاهزة بالكامل (href لكل عقدة + children مُحلَّلة تكراريًّا) تُمرَّر لمكوّن عرض بحت، لا يعرف شيئًا عن
// section_key/category_id/SECTION_ROUTES إطلاقًا. عقدة لا تُحلّ ⇒ تُستبعَد هي وكامل فرعها (نفس
// السياسة على كل مستوى، بلا استثناء) — القرار الصادق المُثبَت سابقًا: لا رابط معطوب، لا 404.
const SECTION_ROUTES: Record<string, string> = {
  matches: '/sport',
};

async function resolveNodeHref(node: SportMenuItemNode): Promise<string | null> {
  if (node.type === 'section') {
    return node.section_key ? (SECTION_ROUTES[node.section_key] ?? null) : null;
  }
  if (node.type === 'category' && node.category_id !== null) {
    // href جاهز من getCategoryById (يعكس Category::canonicalPath() عبر categoryHref في feed.ts) —
    // لا إعادة تركيب مسار يدويًّا هنا إطلاقًا؛ الواجهة مستهلكة للمسار القانوني، لا منشئة له.
    const ref = await getCategoryById(node.category_id);
    return ref?.href ?? null;
  }
  return null;
}

async function resolveMenuNodes(nodes: SportMenuItemNode[]): Promise<ResolvedSportMenuNode[]> {
  const resolved = await Promise.all(
    nodes.map(async (node) => {
      const [href, children] = await Promise.all([resolveNodeHref(node), resolveMenuNodes(node.children)]);
      if (href === null) return null;
      return { id: node.id, title: node.title, icon: node.icon, href, children };
    }),
  );
  return resolved.filter((n): n is ResolvedSportMenuNode => n !== null);
}

export async function SportPrimaryNav() {
  const items = await getSportMenu();
  const resolved = await resolveMenuNodes(items);

  return (
    <nav aria-label="تنقّل الرياضة" className="hidden items-center gap-5 md:flex">
      <Link
        href="/"
        className="rounded-sm text-sm font-bold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
      >
        الرئيسية
      </Link>
      <SportSectionsDropdown items={resolved} />
    </nav>
  );
}
