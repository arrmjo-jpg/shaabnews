'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { DashboardIcon, FileTextIcon, LogOutIcon, UserIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/lib/account-actions';
import { useAuthSession } from '@/lib/use-auth-session';

// Sprint 1.6 Phase 3 (Notifications/User Menu، Commit 1 — project_sport_header_footer_analysis):
// Sport مستهلك بحت للـUnified Entry Point (useAuthSession/logoutAction) — نفس مصدر الجلسة الذي
// يخدم News (UserAuthSlot/UserMenu) وReels (ReelsAccountBlock) بالضبط، بعرض بصريّ خاصّ بـSport
// فقط. لا منطق Session/Auth/Logout جديد هنا — logoutAction() هو الإجراء المشترك نفسه، يُستدعى لا
// يُعاد بناؤه. لا شارة إشعارات هنا عمدًا — تلك مسؤولية Commit 2 المنفصل.
export function SportAccountSlot() {
  const session = useAuthSession();
  const [pending, startTransition] = useTransition();

  // undefined = لم يصل الردّ بعد؛ نفس أبعاد الزرّ لتفادي Layout Shift (نمط useAuthSession نفسه).
  const user = session?.authed ? session.user : null;

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="تسجيل الدخول"
        className="flex size-9 items-center justify-center rounded-md text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <UserIcon className="size-[18px]" aria-hidden />
      </Link>
    );
  }

  const initial = user.name?.trim().charAt(0) || '؟';

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label="حسابي"
        className="flex size-9 items-center justify-center rounded-full text-fg outline-none ring-primary/40 focus-visible:ring-2 data-[state=open]:ring-2"
      >
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-surface-2">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة المستخدم
            <img src={user.avatar} alt={user.name} className="size-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{initial}</span>
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <p className="truncate px-2 py-1.5 text-sm font-bold text-fg">{user.name}</p>

        <DropdownMenuItem asChild>
          <Link href="/account" className="flex cursor-pointer items-center gap-2">
            <DashboardIcon className="size-4" aria-hidden />
            لوحة التحكم
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/profile" className="flex cursor-pointer items-center gap-2">
            <UserIcon className="size-4" aria-hidden />
            ملفي الشخصي
          </Link>
        </DropdownMenuItem>
        {user.is_writer && (
          <DropdownMenuItem asChild>
            <Link href="/account/content?tab=articles" className="flex cursor-pointer items-center gap-2">
              <FileTextIcon className="size-4" aria-hidden />
              مقالاتي
            </Link>
          </DropdownMenuItem>
        )}

        <div className="my-1 h-px bg-border" />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => logoutAction());
          }}
          className="flex cursor-pointer items-center gap-2 text-danger focus:text-danger"
        >
          <LogOutIcon className="size-4" aria-hidden />
          {pending ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
