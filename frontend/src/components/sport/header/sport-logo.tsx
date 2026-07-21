import Link from 'next/link';

// Phase 2.2 Commit 3 — الشعار الحقيقيّ من Public Sport Settings (Phase 2.1: `sport.logo_light`،
// مصدره الفعليّ GeneralSettings::logo_light_sports). نفس فلسفة SiteLogo (components/branding/
// site-logo.tsx: «المكان الوحيد» للشعار العامّ) لكن نسخة صغيرة خاصّة بالرياضة داخل نطاق هذا
// الـCommit فقط — لا تعديل على SiteLogo نفسه (خارج الملفات المسموح بها). فراغ الشعار ⇒ نص بديل
// «الرياضة» (نفس سياسة الفشل الصادق في SiteLogo)، بلا أي معالجة ألوان (لا filter/invert).
// المتغيّر المستخدَم دائمًا «light» (logo_light) لأنّ خلفية الهيدر الحاليّة فاتحة (bg-surface) —
// يتغيّر إلى logo_dark فقط حين يصبح Header 1 داكنًا فعليًّا في Commit لاحق (خارج نطاق هذا الـCommit).
const FOCUS_RING = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function SportLogo({ src }: { src: string | null }) {
  if (!src) {
    return (
      <Link href="/sport" className={`shrink-0 text-base font-extrabold text-fg ${FOCUS_RING}`}>
        الرياضة
      </Link>
    );
  }

  return (
    <Link href="/sport" className={`shrink-0 ${FOCUS_RING}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- نفس سياسة SiteLogo: نقطة تبديل واحدة لاحقاً لـ next/image */}
      <img src={src} alt="الرياضة" className="h-8 w-auto" loading="eager" decoding="async" />
    </Link>
  );
}
