'use client';

import Link from 'next/link';
import { BellIcon } from '@/components/icons';
import { useAuthSession } from '@/lib/use-auth-session';

// Sprint 1.6 Phase 3 (Notifications/User Menu، Commit 2 — project_sport_header_footer_analysis):
// نفس مصدر الجلسة الموحَّد المُستهلَك في SportAccountSlot (Commit 1) — لا Fetch جديد، لا Polling،
// لا WebSocket، لا Realtime: unreadCount يأتي من نفس استجابة /api/auth/session الحالية
// (لقطة واحدة عند التحميل، بلا تحديث حيّ)، بالضبط كما تعمل بقيّة الموقع اليوم. رابط مباشر لصفحة
// الإشعارات الموجودة أصلًا (/account/notifications) — لا صفحة/منطق جديد. مخفيّ للزائر غير
// المسجَّل (لا مفهوم "إشعارات" بلا حساب) — نفس سلوك News (زرّ الإشعارات موجود فقط داخل قائمة
// المستخدم المسجَّل هناك أيضًا).
export function SportNotificationsSlot() {
  const session = useAuthSession();

  if (!session?.authed) return null;

  const unread = session.unreadCount;
  const badge = unread > 9 ? '9+' : String(unread);

  return (
    <Link
      href="/account/notifications"
      aria-label="الإشعارات"
      className="relative flex size-9 items-center justify-center rounded-md text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <BellIcon className="size-[18px]" aria-hidden />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground ring-2 ring-surface">
          {badge}
        </span>
      )}
    </Link>
  );
}
