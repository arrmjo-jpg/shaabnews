'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// شاشة انتقال بين الصفحات — شعار الموقع + ثلاث نقاط تنبض بالتتابع، بنمط الجزيرة نت. تُظهَر فور
// النقر على أي رابط داخليّ (لا تنتظر بدء التنقّل الفعليّ من Next — النقر نفسه إشارة كافية وأسرع
// إدراكيًّا)، وتُخفى تلقائيًّا حين يلتزم المسار (pathname) الجديد. الشعار Server Component
// (يجيب إعدادات الموقع) فيُمرَّر من RootLayout كـchildren لا يُستورَد هنا مباشرة — هذا الملف
// عميليّ (يحتاج useState/useEffect) ولا يقدر يستدعي مكوّنًا خادميًّا غير متزامن بنفسه.
export function RouteLoadingOverlay({ logo }: { logo: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setPending(false);
    }
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // طور الالتقاط إلزاميّ هنا: App Router يُرطِّب على document نفسه
      // (next/dist/client/app-index.js:30 — `const appElement = document`)، فمستمعو React
      // المفوَّضون مركَّبون على document في طور الفقاعة ومسجَّلون قبل هذا الـeffect. ومعالج
      // <Link> يستدعي preventDefault لكلّ رابط داخليّ (next/dist/client/link.js:94). فالمستمع
      // في طور الفقاعة كان يصل دائمًا وdefaultPrevented=true ⇒ الشرط أدناه يخرج فورًا ⇒ الشاشة
      // لم تكن تظهر ولا مرّة في أيّ تنقّل عبر <Link> (وهي كلّ التنقّل الداخليّ في الموقع). في
      // طور الالتقاط نصل قبل React، فيبقى defaultPrevented=false ويبقى الفحص مفيدًا لالتقاط ما
      // ألغاه مستمع التقاط أسبق فقط.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.hasAttribute('download')) return;
      // أيّ target غير _self يفتح خارج هذا المستند (_blank/_parent/_top/اسم إطار) ⇒ لا تنقّل هنا.
      const target = anchor.getAttribute('target');
      if (target && target !== '_self') return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // خارجيّ/mailto:/tel: أو نفس المسار الحالي (رابط تجزئة أو تغيير query فقط) ⇒ بلا شاشة
      // تحميل. استثناء نفس المسار مقصود: الإخفاء معلَّق على تغيّر pathname وحده، فتنقّل يغيّر
      // الـquery فقط (?page=2) لن يغيّره ⇒ كانت الشاشة ستبقى عالقة إلى ما لا نهاية.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      setPending(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // شبكة أمان بلا مؤقّتات: تنقّل لم يُنتج تغيّر pathname (فشل شبكة فيسقط Next إلى تنقّل صلب،
  // أو مغادرة/عودة للصفحة) لن يُخفي الشاشة بالـeffect أعلاه. pagehide يغطّي مغادرة المستند،
  // وpageshow العودة من bfcache، وvisibilitychange ذهاب النقرة إلى تبويب/تنزيل لم نستثنِه.
  useEffect(() => {
    if (!pending) return;
    const clear = () => setPending(false);
    window.addEventListener('pagehide', clear);
    window.addEventListener('pageshow', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('pageshow', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      // حجاب خفيف (60%) بلا backdrop-blur: الصفحة الحاليّة تبقى مقروءة تحته فيُحسّ الانتقال
      // طبقةً فوق صفحة حقيقيّة لا شاشةَ تحميل كاملة. pointer-events-none كي لا يُعطَّل أيّ
      // تفاعل أثناء الانتظار (زرّ الرجوع، السكرول، رابط آخر).
      className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg/60"
      role="status"
      aria-live="polite"
      aria-label="جارٍ التحميل"
    >
      {/* شفافية 80% لا 20%: مع حجاب 60% كان الشعار عند 20% يذوب في محتوى الصفحة خلفه فلا يُقرأ. */}
      <div className="opacity-80 [&_img]:h-16 [&_img]:w-auto [&_img]:sm:h-20">{logo}</div>
      <div className="flex items-center gap-2">
        {/* ثلاث نقاط. بلا rounded-full عمدًا: القاعدة العامّة [class*='rounded'] في globals.css
            تفرض border-radius:0 !important، فكان وجود الاسم في القائمة يجعلها مربّعات لا نقاطًا؛
            الاستدارة تأتي من .route-loading-dot نفسه (اسم بلا "rounded" فيه) — نفس حيلة
            .carousel-pill القائمة. */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="route-loading-dot size-2.5 bg-fg/70"
            style={{ animationDelay: `${i * 150}ms` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
