'use client';

import { useEffect, useState } from 'react';

import { isForcedDesktop, setForcedDesktop } from '@/lib/site-view';

// شريط فوق الهيدر (يظهر على الموبايل فقط) — مكان واحد يغطّي الاتجاهين: تفعيل «النسخة الكاملة»
// أو الرجوع منها لنسخة الجوال، بدل زر بالقائمة الجانبية + زر عائم منفصل (mobile-nav.tsx /
// return-to-mobile-fab.tsx القديمين). الشكل (الحجم المضخَّم ~3.41x وقت التفعيل) منقول من
// D:\gasem (desktop-view-toggle.tsx: MobileTopToggleBanner) — تعويض تصغير الصفحة كاملةً حين
// يكون viewport=1280 (شجرة /desktop-view) فيصبح كل شيء، بما فيه هذا الشريط، مرئيًّا بحجم مصغَّر
// تقريبيًّا (initial-scale ≈ 0.29 لموبايل 375px)؛ التضخيم يحافظ على وضوحه وقابليّته للمس.
//
// **لا `if (!mounted) return null` هنا عمدًا** (كانت موجودة بالنسخة السابقة، أُزيلت): كانت تسبّب
// Layout Shift حقيقيًّا على كل زيارة موبايل عاديّة (الشريط يظهر فجأة بعد الـhydration ويدفع
// الهيدر لتحت) — نفس المكوّن يُرندَر بكلتا الشجرتين (mobile وdesktop، عبر إعادة تصدير الـlayout
// الواحد)، فحالته الافتراضية (forced=false) تطابق الرندر الأوّليّ على شجرة الموبايل تمامًا؛ فرق
// الحجم (الشريط الكبير المضخَّم) على شجرة /desktop-view يبقى يظهر بعد أوّل رسمة (قراءة الكوكيز
// عميليّة بحتة، لا يمكن أن تصير قبل الـhydration بأمان بلا Hydration Mismatch) — قيد معروف، مذكور
// بالتوثيق (docs/desktop-view.md)، وليس ضمن نطاق هذا الإصلاح لأنه يتطلّب تمرير prop عبر الـlayout
// المشترك (site)/layout.tsx، وهو ممنوع صراحةً (كل منطق /desktop-view الجديد محصور بـmiddleware.ts
// وapp/desktop-view/layout.tsx فقط).
export function MobileTopToggleBanner() {
  const [forced, setForced] = useState(false);

  useEffect(() => {
    setForced(isForcedDesktop());
  }, []);

  // لا lg:hidden وقت forced=true: لو اختفى الشريط فور التفعيل (لأنّ viewport=1280 يفعّل
  // breakpoint الـlg نفسه) ما ضلّت في طريقة للرجوع منه — نفس سبب وجود return-to-mobile-fab.tsx
  // قديمًا، وهذا الشريط يحلّ محلّه بدل الاعتماد على زر عائم منفصل.
  const containerClass = forced
    ? 'w-full bg-surface-2 border-b-[3.75px] border-border/80 px-[51px] py-[34px] flex justify-center items-center print:hidden select-none'
    : 'w-full bg-surface-2 border-b border-border/80 px-4 py-2.5 flex justify-center items-center print:hidden select-none lg:hidden';

  const buttonClass = forced
    ? 'w-full text-center py-[34px] text-[47px] leading-none font-extrabold inline-flex items-center justify-center gap-[26px] rounded-none border-[3.75px] border-border/80 bg-surface px-[51px] text-fg transition-all hover:bg-surface-3 hover:border-primary/50 focus-visible:outline-none'
    : 'w-full text-center py-2.5 text-sm font-extrabold inline-flex items-center justify-center gap-2 rounded-none border border-border/80 bg-surface px-4 text-fg transition-all hover:bg-surface-3 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary';

  const iconSize = forced ? 55 : 16;
  const iconClass = forced ? 'w-[55px] h-[55px] text-primary shrink-0' : 'size-4 text-primary shrink-0';
  const strokeWidth = forced ? '8.5' : '2.5';

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={() => setForcedDesktop(!forced)}
        className={buttonClass}
        aria-label={forced ? 'عرض نسخة الجوال' : 'عرض النسخة الكاملة'}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>{forced ? 'عرض نسخة الجوال' : 'عرض النسخة الكاملة'}</span>
      </button>
    </div>
  );
}
