'use client';

import { useEffect, useState } from 'react';

// جلسة المستخدم الدنيا اللازمة للواجهة فقط (اسم/أفتار/صفة كاتب) — وليست AccountUser الكاملة
// (تحتوي بريدًا/هاتفًا/حالة كتابة إلخ، غير لازمة هنا ولا يجب تسريبها لأي كاش وسيط).
export interface SessionUser {
  name: string;
  avatar: string | null;
  is_writer: boolean;
}

export interface AuthSession {
  authed: boolean;
  user: SessionUser | null;
  unreadCount: number;
}

const GUEST: AuthSession = { authed: false, user: null, unreadCount: 0 };

// يجلب حالة تسجيل الدخول من العميل بعد mount (وليس أثناء الـ render الخادميّ) — هذا هو صميم
// إصلاح ISR: cookies() تُقرأ فقط داخل /api/auth/session (Route Handler، لا يؤثّر على قابلية
// تخزين الصفحة)، لا داخل شجرة الـ render لأي صفحة. `undefined` = لم يصل الردّ بعد (حالة تحميل)؛
// المستهلك يعرض fallback بنفس الأبعاد بالضبط لتفادي Layout Shift.
export function useAuthSession(): AuthSession | undefined {
  const [session, setSession] = useState<AuthSession | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<AuthSession>) : GUEST))
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession(GUEST);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
