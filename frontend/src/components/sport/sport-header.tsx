import { Container } from '@/components/layout/container';
import { SportHeaderActions } from '@/components/sport/header/sport-header-actions';
import { SportLogo } from '@/components/sport/header/sport-logo';
import { SportPrimaryNav } from '@/components/sport/header/sport-primary-nav';
import { getSiteSettings } from '@/lib/site-settings';
import { DEFAULT_SPORT_THEME_COOKIE } from '@/lib/sport/theme-cookie';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط Public Sport Settings فقط): شعار حقيقيّ من
// `sport.logo_light` + إظهار/إخفاء زرّ المظهر من `sport.allow_theme_switch`. `getSiteSettings()`
// مُلفوفة بـ React `cache()` — تُستدعى هنا ومرّة أخرى داخل (sport)/layout.tsx (لـCookiePolicyModal
// وسكربت تهيئة الثيم) دون طلبَي شبكة حقيقيّين (نفس نمط الجلب المزدوج المُثبَت في Team/Player/
// Match/Competition Step 2). SportMenu/Notifications/User Menu/Search أُنجزت في Commits لاحقة
// (راجع project_sport_header_footer_analysis). Theme (Sprint 1.7، Phase T3): `themeCookieName`
// يُمرَّر إلى SportHeaderActions لتفعيل زرّ التبديل الحقيقيّ — لا Context/Provider (قرار ADR:
// المستهلك الوحيد هو الزرّ). `sport.secondary_color` يبقى غير مستهلَك (لا موضع طبيعيّ له بعد).
export async function SportHeader() {
  const settings = await getSiteSettings();
  const logoSrc = settings?.sport?.logo_light ?? null;
  const allowThemeSwitch = settings?.sport?.allow_theme_switch ?? true;
  const themeCookieName = settings?.sport?.theme_cookie || DEFAULT_SPORT_THEME_COOKIE;

  return (
    <header className="sport-scope relative border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <SportLogo src={logoSrc} />
          <SportPrimaryNav />
        </div>
        <SportHeaderActions allowThemeSwitch={allowThemeSwitch} themeCookieName={themeCookieName} />
      </Container>
    </header>
  );
}
