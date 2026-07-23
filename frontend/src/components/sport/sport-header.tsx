import { Container } from '@/components/layout/container';
import { SportHeaderActions } from '@/components/sport/header/sport-header-actions';
import { SportLogo } from '@/components/sport/header/sport-logo';
import { SportPrimaryNav } from '@/components/sport/header/sport-primary-nav';
import { getSiteSettings } from '@/lib/site-settings';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط Public Sport Settings فقط): شعار حقيقيّ من
// `sport.logo_light` + إظهار/إخفاء زرّ المظهر من `sport.allow_theme_switch`. `getSiteSettings()`
// مُلفوفة بـ React `cache()` — تُستدعى هنا ومرّة أخرى داخل (sport)/layout.tsx (لـCookiePolicyModal)
// دون طلبَي شبكة حقيقيّين (نفس نمط الجلب المزدوج المُثبَت في Team/Player/Match/Competition Step 2).
// SportMenu/Notifications/User Menu/Search أُنجزت في Commits لاحقة (راجع project_sport_header_footer_analysis).
// لا يزال خارج النطاق: Theme Persistence/Provider (مؤجَّلة عمدًا لنهاية Phase 3)، لا تعديل على
// (sport)/layout.tsx. `sport.secondary_color`/`default_theme`
// قُرئا من نوع الإعدادات لكن لم يُطبَّقا: لا موضع طبيعيّ لهما في البنية الحاليّة بلا اختراع معالجة
// بصريّة جديدة (وهذا بالضبط ما يقود لتغيير معماريّ — يُوقَف عنده، لا يُوسَّع الـCommit من تلقاء نفسه).
export async function SportHeader() {
  const settings = await getSiteSettings();
  const logoSrc = settings?.sport?.logo_light ?? null;
  const allowThemeSwitch = settings?.sport?.allow_theme_switch ?? true;

  return (
    <header className="relative border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <SportLogo src={logoSrc} />
          <SportPrimaryNav />
        </div>
        <SportHeaderActions allowThemeSwitch={allowThemeSwitch} />
      </Container>
    </header>
  );
}
