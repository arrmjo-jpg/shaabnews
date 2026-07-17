'use client';

import Link from 'next/link';

import { UserIcon } from '@/components/icons';
import { UserMenu } from '@/components/layout/user-menu';
import { ReelsAccountBlock } from '@/components/reels/reels-extras';
import { useAuthSession } from '@/lib/use-auth-session';

// فتحة معزولة موحَّدة لعرض حالة تسجيل الدخول (هيدر الموقع + شريط الريلز) — الاستخدام الوحيد
// لـ useAuthSession خارج مكوّنات عميلة أخرى بالفعل (مثل CommentForm).
//
// **لماذا variant وليس render-props؟** كانت النسخة الأولى تأخذ `children` كدالة (render prop)
// لتُبنى واجهة "مسجَّل دخول" بالبيانات الفعلية — لكن React Server Components يمنع تمرير أي
// Function prop من Server Component (مثل SiteHeader/ReelsSidebar) إلى Client Component؛
// فشل `next build` فعليًا بهذا السبب بالضبط. الحلّ: كل منطق العرض (الهيدر/الريلز) داخل هذا
// الملف نفسه (عميل بالكامل)، ويُستدعى بخاصية `variant` النصّية البسيطة (قابلة للتسلسل) فقط.
const GUEST_LINK = (
  <Link
    href="/login"
    aria-label="تسجيل الدخول"
    className="inline-flex size-10 items-center justify-center text-fg outline-none transition-colors hover:text-primary focus-visible:text-primary"
  >
    <UserIcon className="size-5" aria-hidden />
  </Link>
);

export function UserAuthSlot({ variant }: { variant: 'header' | 'reels' }) {
  const session = useAuthSession();
  const user = session?.authed ? session.user : null;

  if (variant === 'reels') {
    return <ReelsAccountBlock user={user} />;
  }

  if (!user) return GUEST_LINK;

  return (
    <UserMenu name={user.name} avatar={user.avatar} isWriter={user.is_writer} unread={session?.unreadCount ?? 0} />
  );
}
