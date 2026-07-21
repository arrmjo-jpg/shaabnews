import { Container } from '@/components/layout/container';
import { SportHeaderActions } from '@/components/sport/header/sport-header-actions';
import { SportLogo } from '@/components/sport/header/sport-logo';
import { SportPrimaryNav } from '@/components/sport/header/sport-primary-nav';
import { getSiteSettings } from '@/lib/site-settings';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط Public Sport Settings فقط): شعار حقيقيّ من
// `sport.logo_light` + إظهار/إخفاء زرّ المظهر من `sport.allow_theme_switch`. `getSiteSettings()`
// مُلفوفة بـ React `cache()` — تُستدعى هنا ومرّة أخرى داخل (sport)/layout.tsx (لـCookiePolicyModal)
// دون طلبَي شبكة حقيقيّين (نفس نمط الجلب المزدوج المُثبَت في Team/Player/Match/Competition Step 2).
// لا SportMenu، لا Search، لا Notifications، لا User Menu، لا Theme Persistence/Provider، لا تعديل
// على (sport)/layout.tsx — كلّها خارج نطاق هذا الـCommit. `sport.secondary_color`/`default_theme`
// قُرئا من نوع الإعدادات لكن لم يُطبَّقا: لا موضع طبيعيّ لهما في البنية الحاليّة بلا اختراع معالجة
// بصريّة جديدة (وهذا بالضبط ما يقود لتغيير معماريّ — يُوقَف عنده، لا يُوسَّع الـCommit من تلقاء نفسه).
export async function SportHeader() {
  const settings = await getSiteSettings();
  const logoSrc = settings?.sport?.logo_light ?? null;
  const allowThemeSwitch = settings?.sport?.allow_theme_switch ?? true;

  return (
    <header className="border-b border-border bg-surface">
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
