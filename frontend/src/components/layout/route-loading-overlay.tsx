'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// شاشة انتقال بين الصفحات — شعار الموقع باهت + نقاط تنبض بالتتابع، بنمط الجزيرة نت. تُظهَر فور
// النقر على أي رابط داخليّ (لا تنتظر بدء التنقّل الفعليّ من Next — النقر نفسه إشارة كافية وأسرع
// إدراكيًّا)، وتُخفى تلقائيًّا حين يلتزم المسار (pathname) الجديد. الشعار Server Component
// (يجيب إعدادات الموقع) فيُمرَّر من RootLayout كـchildren لا يُستورَد هنا مباشرة — هذا الملف
// عميليّ (يحتاج useState/useEffect) ولا يقدر يستدعي مكوّنًا خادميًّا غير متزامن بنفسه.
export function RouteLoadingOverlay({ logo }: { logo: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const prevPathname = useRef(pathname);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setPending(false);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    }
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // خارجيّ/mailto:/tel: أو نفس المسار الحالي (رابط تجزئة فقط) ⇒ بلا شاشة تحميل.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      setPending(true);
      // شبكة صفريّة (chunk مُخبَّأ، تنقّل فوريّ) لا تحتاج الشاشة فعليًّا؛ إخفاء تلقائيّ بعد مهلة
      // أمان يمنع بقاءها عالقة لو فشل التنقّل لأي سبب (تنقّل ألغاه المتصفح، خطأ شبكة...).
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => setPending(false), 8000);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="جارٍ التحميل"
    >
      <div className="opacity-20 [&_img]:h-16 [&_img]:w-auto [&_img]:sm:h-20">{logo}</div>
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="route-loading-dot size-2.5 rounded-full bg-fg/50"
            style={{ animationDelay: `${i * 150}ms` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
