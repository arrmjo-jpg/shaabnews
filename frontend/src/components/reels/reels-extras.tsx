import Link from 'next/link';

import { socialEntries } from '@/components/layout/social-map';
import type { SessionUser } from '@/lib/use-auth-session';

// كتلتا «الحساب/الدخول» و«السوشيل» — مشتركتان بين الشريط الجانبيّ (ديسكتوب) ودرج الجوّال
// (تُمرَّران كعنصر مُهيّأ من الصفحة الخادميّة للدرج العميل). مُثيَّمتان عبر متغيّرات --rl-*.
// user: SessionUser (اسم/أفتار فقط) وليس AccountUser الكاملة — يُحسَم الآن عميليًّا عبر
// UserAuthSlot/useAuthSession بدل getCurrentUser() خادميّ (كان يُسقِط صفحات الريلز من ISR).

export function ReelsAccountBlock({ user, onNavigate }: { user: SessionUser | null; onNavigate?: () => void }) {
  if (user) {
    return (
      <Link
        href="/account"
        onClick={onNavigate}
        className="flex items-center gap-3 bg-[var(--rl-hover)] p-3 transition-colors hover:opacity-90"
        style={{ borderRadius: '12px' }}
      >
        <span
          className="grid size-9 shrink-0 place-items-center overflow-hidden bg-primary text-sm font-black text-primary-foreground"
          style={{ borderRadius: '9999px' }}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة المستخدم
            <img src={user.avatar} alt="" className="size-full object-cover" />
          ) : (
            user.name.slice(0, 1)
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-[var(--rl-fg)]">{user.name}</span>
          <span className="block text-xs text-[var(--rl-muted)]">حسابي</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Link
        href="/login"
        onClick={onNavigate}
        className="flex items-center justify-center bg-primary px-3 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        style={{ borderRadius: '10px' }}
      >
        تسجيل الدخول
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        className="flex items-center justify-center border border-[var(--rl-border)] px-3 py-2.5 text-sm font-bold text-[var(--rl-fg)] transition hover:bg-[var(--rl-hover)]"
        style={{ borderRadius: '10px' }}
      >
        حساب جديد
      </Link>
    </div>
  );
}

export function ReelsSocialRow({ social }: { social: ReturnType<typeof socialEntries> }) {
  if (social.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-1.5">
      {social.map(({ key, url, Icon, label }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="grid size-9 place-items-center text-[var(--rl-fg)] transition-colors hover:bg-[var(--rl-hover)]"
          style={{ borderRadius: '9999px' }}
        >
          <Icon className="size-[18px]" />
        </a>
      ))}
    </div>
  );
}
