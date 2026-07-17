import { NextResponse } from 'next/server';

import { getUnreadCount } from '@/lib/account';
import { getCurrentUser } from '@/lib/auth';

// جلسة دنيا للعميل (اسم/أفتار/صفة كاتب/عدّاد غير مقروء) — الغرض الوحيد لهذا الـ Route Handler
// هو عزل cookies() هنا بعيدًا عن شجرة الـ render لأي صفحة (Route Handlers لا تُصنَّف الصفحة
// dynamic بسببها إطلاقًا). لا تُضِف حقولاً إضافية من AccountUser (بريد/هاتف/إلخ) — هذا الردّ
// يمرّ عبر الشبكة للعميل مباشرة، فلا داعٍ لتسريب أكثر مما تحتاجه الواجهة فعليًا.
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadCount() : 0;

  return NextResponse.json(
    {
      authed: user !== null,
      user: user ? { name: user.name, avatar: user.avatar ?? null, is_writer: user.is_writer } : null,
      unreadCount,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    },
  );
}
