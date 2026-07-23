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
// UI, not News chrome — see the ADR's Layout Ownership decision). Sport Menu/logo/search landed in
// later commits; Theme bootstrap (Sprint 1.7 Phase T1) below is the first Theme-related code here —
// [data-sport-theme] is set pre-paint from the sport_theme cookie/getSiteSettings() defaults, never
// from cookies()/next-headers (would break ISR — see use-auth-session.ts). Nothing reads the
// attribute yet (no CSS, no consumer) — zero visual change until Phase T5.
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
      <main className="flex-1">{children}</main>
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
