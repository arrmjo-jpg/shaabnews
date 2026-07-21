import Link from 'next/link';

// Phase 2.2 Commit 2 — شعار نصّي مؤقّت. لا صورة ولا ألوان من الإعدادات هنا (Public Sport Settings
// تُربط في Commit لاحق منفصل) — بنية فقط.
export function SportLogoPlaceholder() {
  return (
    <Link href="/sport" className="shrink-0 text-base font-extrabold text-fg">
      الرياضة
    </Link>
  );
}
