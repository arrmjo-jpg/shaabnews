import { CookiePolicyModal } from '@/components/layout/cookie-policy-modal';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SportFooter } from '@/components/sport/sport-footer';
import { SportHeader } from '@/components/sport/sport-header';
import { FollowProvider } from '@/lib/follow-context';
import { getSiteSettings } from '@/lib/site-settings';
import { buildThemeBootstrapScript, DEFAULT_SPORT_THEME_COOKIE } from '@/lib/sport/theme-cookie';

// Phase 2.2 Commit 1 — Sport's own route-group root (approved ADR: sibling to (site), never inside
// it — (site)/layout.tsx has no override hook for its chrome, and (reels) is the only existing
// precedent for independent chrome in this app). Architecture-only commit: placeholder
// SportHeader/SportFooter, FollowProvider carried over unchanged (previously wrapped one level
// deeper in sport/layout.tsx, consolidated here to match the approved Layout Ownership model),
// MobileBottomNav and CookiePolicyModal reused exactly as agreed (both are application-level shared
// UI, not News chrome — see the ADR's Layout Ownership decision). Theme bootstrap (Sprint 1.7 Phase
// T1) sets [data-sport-theme] pre-paint from the sport_theme cookie/getSiteSettings() defaults,
// never from cookies()/next-headers (would break ISR — see use-auth-session.ts). Theme SCOPE
// correction (post-1.7): `.sport-scope` on <main> means the theme now governs the content area +
// Footer only — Header is permanently dark via its own `.sport-header-scope` (sport-header.tsx),
// entirely outside [data-sport-theme]'s reach. `bg-bg` on <main> itself (palette refinement):
// <body>'s own bg-bg sits outside .sport-scope, so without this <main> stayed transparent and let
// the page's light backdrop show through gaps/margins around dark cards — a real gap found while
// verifying, not present before cards themselves went theme-aware.
export default async function SportLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const themeScript = buildThemeBootstrapScript(
    settings?.sport?.theme_cookie || DEFAULT_SPORT_THEME_COOKIE,
    settings?.sport?.default_theme || 'dark',
  );

  return (
    <FollowProvider>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <SportHeader />
      <main className="sport-scope flex-1 bg-bg">{children}</main>
      <SportFooter />
      {/* فاصل يمنع شريط التنقّل السفليّ الثابت من تغطية آخر الفوتر على الموبايل (نفس نمط (site)) */}
      <div className="h-14 lg:hidden" aria-hidden />
      <MobileBottomNav />
      <CookiePolicyModal
        text={settings?.cookie_policy?.trim() || ''}
        hideTrigger
        autoOpenKey="acm_cookie_ack"
      />
    </FollowProvider>
  );
}
