import Link from 'next/link';
import { ChevronDownIcon } from '@/components/icons';

// Phase 2.2 Commit 2 — تنقّل أساسيّ: رابط ثابت حقيقي («الرئيسية») + عنصر «الأقسام» بمكانه فقط
// (بلا قائمة، بلا بيانات، بلا تفاعل) — يتحوّل إلى قائمة منسدلة حقيقية عند ربط Sport Menu
// في Commit لاحق منفصل. مخفيّ على الموبايل (< md) لأنّ MobileBottomNav يغطّي التنقّل الأساسيّ هناك.
export function SportPrimaryNav() {
  return (
    <nav aria-label="تنقّل الرياضة" className="hidden items-center gap-5 md:flex">
      <Link href="/" className="text-sm font-bold text-muted transition-colors hover:text-fg">
        الرئيسية
      </Link>
      <span className="flex items-center gap-1 text-sm font-bold text-muted">
        الأقسام
        <ChevronDownIcon className="size-4" aria-hidden />
      </span>
    </nav>
  );
}
