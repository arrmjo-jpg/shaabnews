import Link from 'next/link';
import { getCategorySubtree, type CategoryTreeNode } from '@/lib/feed';
import { SportSectionsDropdown, type ResolvedSportMenuNode } from '@/components/sport/header/sport-sections-dropdown';

// تصحيح Sprint 1.7 (بند 4): «الأقسام» تعرض الآن شجرة تصنيفات CMS الحقيقيّة (getCategorySubtree)،
// لا SportMenuItem (كان فارغًا في القاعدة أصلًا ومنفصلًا يدويًّا عن شجرة Category الفعليّة —
// تعديله كان يعني إعادة بناء الشجرة يدويًّا مرّتين، لا مصدرًا واحدًا للحقيقة). SportMenuItem نفسها
// (الجدول/الإدارة/الـAPI) تبقى موجودة بلا حذف — فقط هذا المستهلك توقّف عن استخدامها. نفس ثابت
// SPORTS_CATEGORY_ID المستخدَم فعليًّا في sport-news.tsx (تعليق "الرياضة=4" في (site)/page.tsx:28)
// — لا يُخترَع معرّف جديد. مخفيّ على الموبايل (< md) لأنّ MobileBottomNav يغطّي التنقّل الأساسيّ
// هناك — لم يتغيّر.
const SPORTS_CATEGORY_ID = 4;

function toResolvedNode(node: CategoryTreeNode): ResolvedSportMenuNode {
  return {
    id: node.id,
    title: node.name,
    icon: node.icon,
    href: node.href,
    children: node.children.map(toResolvedNode),
  };
}

export async function SportPrimaryNav() {
  const children = await getCategorySubtree(SPORTS_CATEGORY_ID);
  const resolved = children.map(toResolvedNode);

  return (
    <nav aria-label="تنقّل الرياضة" className="hidden items-center gap-5 md:flex">
      <Link
        href="/"
        className="rounded-sm text-sm font-bold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
      >
        الأخبار
      </Link>
      <SportSectionsDropdown items={resolved} />
    </nav>
  );
}
