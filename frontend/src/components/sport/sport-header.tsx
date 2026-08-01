import { Container } from '@/components/layout/container';
import { SportHeaderActions } from '@/components/sport/header/sport-header-actions';
import { SportLogo } from '@/components/sport/header/sport-logo';
import { SportPrimaryNav } from '@/components/sport/header/sport-primary-nav';
import { SportsNav } from '@/components/sport/sports-nav';
import { getSiteSettings } from '@/lib/site-settings';
import { DEFAULT_SPORT_THEME_COOKIE } from '@/lib/sport/theme-cookie';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط Public Sport Settings فقط) + تصحيح لاحق: الهيدر أصبح
// دائمًا داكنًا (#4E4E4E)، خارج نطاق الثيم تمامًا — .sport-header-scope (globals.css) غير مشروطة
// بحالة الثيم إطلاقًا، بعكس .sport-scope (الفوتر/المحتوى). الشعار يقرأ logo_dark دائمًا الآن (لا
// logo_light) لأنّ خلفية الهيدر داكنة ثابتة، لا فاتحة كما كانت سابقًا. `getSiteSettings()` مُلفوفة
// بـReact `cache()` — تُستدعى هنا ومرّة أخرى داخل (sport)/layout.tsx دون طلبَي شبكة حقيقيّين (نفس
// نمط الجلب المزدوج المُثبَت في Team/Player/Match/Competition Step 2). Theme (Sprint 1.7، Phase
// T3): `themeCookieName` يُمرَّر إلى SportHeaderActions لتفعيل زرّ التبديل الحقيقيّ (يتحكّم بثيم
// المحتوى/الفوتر فقط الآن، لا الهيدر) — لا Context/Provider (قرار ADR: المستهلك الوحيد هو الزرّ).
//
// بنية 365Scores (قرار جديد): صفّان داخل هيدر واحد ثابت (Sticky) — الشريط العلوي (شعار/تنقّل
// رئيسي/إجراءات) + صفّ التنقّل بين أنواع الرياضة (SportsNav) أسفله مباشرة، كلاهما ضمن نفس
// .sport-header-scope فيرثان نفس متغيّرات الثيم الداكنة تلقائيًّا (لا CSS جديد لهذا). SportsNav
// انتقلت من محتوى الصفحة (SportSection) إلى هنا — كروم دائم عبر كل صفحات /sport/**، لا مرتبطة
// بصفحة بعينها بعد اليوم.
export async function SportHeader() {
  const settings = await getSiteSettings();
  const logoSrc = settings?.sport?.logo_dark ?? null;
  const allowThemeSwitch = settings?.sport?.allow_theme_switch ?? true;
  const themeCookieName = settings?.sport?.theme_cookie || DEFAULT_SPORT_THEME_COOKIE;

  return (
    <header className="sport-header-scope sticky top-0 z-40 border-b border-border">
      <Container className="flex h-[88px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <SportLogo src={logoSrc} />
          <SportPrimaryNav />
        </div>
        <SportHeaderActions allowThemeSwitch={allowThemeSwitch} themeCookieName={themeCookieName} />
      </Container>
      <div className="border-t border-border">
        <Container className="py-2.5">
          <SportsNav />
        </Container>
      </div>
    </header>
  );
}
