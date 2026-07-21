import Link from 'next/link';
import { SportSectionsDropdown } from '@/components/sport/header/sport-sections-dropdown';
import { getSportMenu } from '@/lib/sport-menu';

// Sprint 1 Commit 5 — «الأقسام» أصبحت قائمة منسدلة حقيقية مربوطة بـ /api/v1/sport-menu (Commit 4).
// نداء getSportMenu() هنا مباشرةً (لا رفعه لـ SportHeader قسرًا) — نفس النمط المعتمد صراحةً في
// مراجعة Commit 3: أيّ Server Component يحتاج بيانات مصدرها ملفوف بـ React.cache() يستدعيها
// مباشرةً، والفصل بين المسؤوليات هو ما يقرّر أين يُجلَب لا الخوف من تكرار وهميّ. مخفيّ على الموبايل
// (< md) لأنّ MobileBottomNav يغطّي التنقّل الأساسيّ هناك — لم يتغيّر.
export async function SportPrimaryNav() {
  const items = await getSportMenu();

  return (
    <nav aria-label="تنقّل الرياضة" className="hidden items-center gap-5 md:flex">
      <Link
        href="/"
        className="rounded-sm text-sm font-bold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
      >
        الرئيسية
      </Link>
      <SportSectionsDropdown items={items} />
    </nav>
  );
}
