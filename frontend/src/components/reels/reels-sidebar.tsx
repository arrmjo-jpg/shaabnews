import Link from 'next/link';

import { UserAuthSlot } from '@/components/auth/user-auth-slot';
import { socialEntries } from '@/components/layout/social-map';
import { REELS_PRIMARY, REELS_SERVICES } from '@/lib/reels-nav';
import { getSiteSettings } from '@/lib/site-settings';

import { ReelsSocialRow } from './reels-extras';
import { ReelsThemeToggle } from './reels-theme-toggle';

// الشريط الجانبيّ لصفحة الريلز (ديسكتوب) — يدعم الداكن/الفاتح عبر متغيّرات الثيم (--rl-*):
// شعار + تنقّل أساسيّ + خدمات الموقع (بدل الأقسام) + بطاقة حساب/دخول + روابط سوشيل + زرّ الثيم.
// بطاقة الحساب معزولة عميليًّا (UserAuthSlot) بدل getCurrentUser() خادميّ — راجع ISR Restoration.
export async function ReelsSidebar() {
  const settings = await getSiteSettings();
  const siteName = settings?.site_name || 'صدى الشعب الأخباري';
  const logoDark = settings?.logo_dark ?? settings?.logo_light ?? null;
  const logoLight = settings?.logo_light ?? settings?.logo_dark ?? null;
  const social = socialEntries(settings?.social);

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-e border-[var(--rl-border)] bg-[var(--rl-panel)] text-[var(--rl-fg)] md:flex lg:w-[320px]">
      {/* الشعار (يتبدّل حسب الثيم) */}
      <div className="flex items-center border-b border-[var(--rl-border)] p-5">
        <Link href="/" aria-label={siteName} className="flex items-center">
          {logoDark || logoLight ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار العلامة */}
              {logoDark ? <img src={logoDark} alt={siteName} className="reels-logo-dark h-12 w-auto object-contain" /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار العلامة (نسخة فاتحة) */}
              {logoLight ? <img src={logoLight} alt={siteName} className="reels-logo-light h-12 w-auto object-contain" /> : null}
            </>
          ) : (
            <span className="text-lg font-black">{siteName}</span>
          )}
        </Link>
      </div>

      {/* التنقّل + الخدمات */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--rl-border)]">
        {REELS_PRIMARY.map((l) => (
          <SideLink key={l.href} href={l.href} active={l.href === '/reels'}>
            <NavIcon href={l.href} />
            {l.label}
          </SideLink>
        ))}

        <p className="mt-4 px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--rl-muted)]">الخدمات</p>
        {REELS_SERVICES.map((l) => (
          <SideLink key={l.href} href={l.href}>
            <ServiceIcon href={l.href} />
            {l.label}
          </SideLink>
        ))}
      </nav>

      {/* الأسفل: الحساب/الدخول + السوشيل + الثيم + الحقوق */}
      <div className="space-y-3 border-t border-[var(--rl-border)] p-3">
        <UserAuthSlot variant="reels" />
        <ReelsSocialRow social={social} />
        <ReelsThemeToggle className="w-full justify-start" />
        <p className="text-center text-xs text-[var(--rl-muted)]">{settings?.copyright || `© ${siteName}`}</p>
      </div>
    </aside>
  );
}

function SideLink({ href, active = false, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${
        active ? 'bg-[var(--rl-hover)] text-primary' : 'text-[var(--rl-fg)] hover:bg-[var(--rl-hover)]'
      }`}
      style={{ borderRadius: '10px' }}
    >
      {children}
    </Link>
  );
}

// أيقونة التنقّل الأساسيّ حسب المسار.
function NavIcon({ href }: { href: string }) {
  const c = 'size-5 shrink-0';
  if (href === '/reels')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={c} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.67a.38.38 0 0 1 0 .66l-5.6 3.11a.38.38 0 0 1-.56-.33V8.89c0-.29.31-.47.56-.33l5.6 3.11Z" />
      </svg>
    );
  if (href === '/latest')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={c} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={c} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.95-8.95c.44-.44 1.16-.44 1.6 0L21.75 12M4.5 9.75v10.13c0 .62.5 1.12 1.13 1.12H9.75V16.5c0-.62.5-1.12 1.13-1.12h2.25c.62 0 1.12.5 1.12 1.12V21h4.13c.62 0 1.12-.5 1.12-1.12V9.75" />
    </svg>
  );
}

// أيقونة خدمة حسب المسار (بسيطة، خطّية).
function ServiceIcon({ href }: { href: string }) {
  const c = 'size-5 shrink-0 text-[var(--rl-muted)]';
  const P = (d: string) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={c} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
  switch (href) {
    case '/videos':
      return P('M3.75 6.75A1.5 1.5 0 0 1 5.25 5.25h13.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6.75ZM10.5 9.5l4 2.5-4 2.5v-5Z');
    case '/gold-prices':
      return P('M12 3c4.97 0 9 1.79 9 4s-4.03 4-9 4-9-1.79-9-4 4.03-4 9-4ZM3 7v5c0 2.21 4.03 4 9 4s9-1.79 9-4V7M3 12v5c0 2.21 4.03 4 9 4s9-1.79 9-4v-5');
    case '/weather':
      return P('M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.58-1.5A3.5 3.5 0 0 1 17 18H7Z');
    case '/bourse':
      return P('M3 3v18h18M7 15l3-4 3 3 5-7');
    case '/sport':
      return P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2 4 5 4 9s-1.5 7-4 9m0-18C9.5 5 8 8 8 12s1.5 7 4 9M3.5 9h17M3.5 15h17');
    case '/economy':
      return P('M3 17l6-6 4 4 8-8M21 7v5M21 7h-5');
    case '/trending':
      return P('M12 3c1.5 3 4 4 4 7a4 4 0 1 1-8 0c0-1.2.5-2 1-2.5C9 10 9.5 12 11 12c.5-2-1-3.5 1-9Z');
    default:
      return P('M4 6h16M4 12h16M4 18h16');
  }
}
