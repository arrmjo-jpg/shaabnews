'use client';

import { useSportTheme } from '@/lib/sport/use-sport-theme';

// زرّ تبديل ثيم الرياضة (Sprint 1.7 Phase T3) — يستهلك useSportTheme فقط، بلا Context (قرار ADR:
// مستهلك JS وحيد). القيمة الابتدائيّة يضبطها سكربت (sport)/layout.tsx قبل الرسم (بلا وميض)؛
// أيقونة محايدة قبل mount (`ready`) لتفادي عدم تطابق الترطيب — نفس أسلوب reels-theme-toggle.tsx.
export function SportThemeToggle({ cookieName }: { cookieName: string }) {
  const { theme, ready, setTheme } = useSportTheme(cookieName);

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  const toLight = theme === 'dark';
  const label = toLight ? 'الوضع الفاتح' : 'الوضع الداكن';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-md text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {!ready || toLight ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="size-[18px]" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="size-[18px]" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
