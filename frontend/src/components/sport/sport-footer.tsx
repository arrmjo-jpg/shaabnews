import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { getSiteSettings } from '@/lib/site-settings';

// Sprint 1 Commit 6 — الفوتر الحقيقيّ الأوّل، لكن مُتعمَّد البساطة: لا أعمدة تصنيفات/تواصل/روابط
// قانونيّة كاملة مثل SiteFooter (news) — الوثيقة المعتمدة (Design Review) لم تُقرّر محتوى Footer
// المفصَّل إطلاقًا، فأيّ إعادة بناء لهيكل SiteFooter الكامل هنا تكون اختراعًا لمتطلَّبات لم تُقرّ،
// لا تنفيذًا لقرار موجود. شعار + حقوق نشر (من Public Sport Settings/SiteSettings الموجودَين
// أصلاً، لا مصدر جديد) + رابط ثابت للرئيسية — بلا Analytics ولا Newsletter ولا Widgets ديناميكيّة.
export async function SportFooter() {
  const settings = await getSiteSettings();
  const logoSrc = settings?.sport?.logo_light ?? null;
  const siteName = settings?.site_name?.trim() || 'الشعب';
  const year = new Date().getFullYear();
  const copyright = settings?.copyright?.trim() || `© ${year} ${siteName} — جميع الحقوق محفوظة.`;

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="flex flex-col items-center gap-3 py-8 text-center">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- نفس سياسة SiteLogo: نقطة تبديل واحدة لاحقاً لـ next/image
          <img src={logoSrc} alt="الرياضة" className="h-7 w-auto" loading="lazy" decoding="async" />
        ) : (
          <span className="text-base font-extrabold text-fg">الرياضة</span>
        )}
        <p className="text-xs text-muted">{copyright}</p>
        <Link
          href="/"
          className="rounded-sm text-xs font-bold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
        >
          العودة إلى الرئيسية
        </Link>
      </Container>
    </footer>
  );
}
