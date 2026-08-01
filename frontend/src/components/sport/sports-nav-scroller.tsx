'use client';

import { useEffect, useRef, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

const ARROW_NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

// غلاف تمرير أفقي عامّ — لا يعرف شيئًا عن "الرياضة"، يستقبل روابط SportsNav (مُصيَّرة على
// الخادم) عبر children بلا أي تحويل لها إلى Client (نمط Next.js الموثَّق: تمرير مخرجات
// Server Component كـchildren إلى Client Component لا يجعلها هي نفسها Client). العنصر
// الأب SportsNav يبقى Server Component بالكامل (روابط/توجيه/حالة نشطة/أيقونات) — التفاعل
// (تمرير + سهمان + لوحة مفاتيح + تلاشي حواف) معزول هنا فقط، وهو أصغر ما يمكن عزله.
//
// يعيد استخدام نفس آليّة LeagueMatchesTicker/LiveScoresStripCards (scrollIntoView عند
// التحميل + scrollBy بالأسهم) لكن مُعمَّمة: البحث عن العنصر النشط عبر [aria-current="page"]
// الموجود أصلاً على الرابط (لا data-* جديد لنفس الغرض)، بدل فهرس مصفوفة بيانات.
export function SportsNavScroller({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // بالمعنى الفيزيائي (لا المنطقي): canScrollRight = يوجد محتوى مخفي أقصى اليمين (سهم
  // "السابق" في RTL)، canScrollLeft = يوجد محتوى مخفي أقصى اليسار (سهم "التالي" في RTL).
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const updateEdges = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 1) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }
      // اصطلاح scrollLeft السالب في RTL (0 = أقصى اليمين، -maxScroll = أقصى اليسار) —
      // موحَّد اليوم عبر Chrome/Firefox/Safari الحديثة، تحقّقنا منه فعليًّا في متصفّح
      // المعاينة قبل اعتماده (راجع تقرير التحقّق المرفق مع هذا الـCommit).
      const sl = el.scrollLeft;
      setCanScrollRight(sl < -1);
      setCanScrollLeft(sl > -maxScroll + 1);
    };

    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', behavior: 'instant' });
    updateEdges();

    // ResizeObserver يرصد تغيّر صندوق el نفسه فقط — لا يلتقط حالة أوّليّة عابرة (قبل استقرار
    // تخطيط flex-1 بين الأطفال) حيث scrollWidth أكبر لحظيًّا من القيمة النهائيّة بلا أي تغيّر
    // لاحق في حجم el ليُطلق ResizeObserver. rAF مزدوج يضمن إعادة الحساب بعد استقرار التخطيط
    // فعليًّا (وُجدت هذه الحالة فعليًّا أثناء التحقّق المباشر في المتصفّح، لا افتراضًا).
    let secondRaf = 0;
    const firstRaf = requestAnimationFrame(() => {
      secondRaf = requestAnimationFrame(updateEdges);
    });

    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro.disconnect();
      cancelAnimationFrame(firstRaf);
      cancelAnimationFrame(secondRaf);
    };
  }, []);

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollByPage = (direction: 'start' | 'end') => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === 'end' ? -amount : amount, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // أسهم لوحة المفاتيح: يمين/يسار مع مراعاة RTL فعليًّا (لا افتراض ثابت) + Home/End —
  // Tab العاديّ بين الروابط يبقى يعمل كما هو، هذا تحسين إضافي فوقه، لا بديل عنه.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ARROW_NAV_KEYS.has(e.key)) return;
    const el = scrollerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (currentIndex === -1) return;

    const isRtl = getComputedStyle(el).direction === 'rtl';
    let nextIndex = currentIndex;
    if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = items.length - 1;
    else if (e.key === 'ArrowLeft') nextIndex = currentIndex + (isRtl ? 1 : -1);
    else if (e.key === 'ArrowRight') nextIndex = currentIndex + (isRtl ? -1 : 1);

    nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
    if (nextIndex === currentIndex) return;
    e.preventDefault();
    items[nextIndex].focus();
    items[nextIndex].scrollIntoView({ inline: 'center', block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const maskStop = (fade: boolean) => (fade ? 'transparent' : 'black');
  const maskImage = `linear-gradient(to right, ${maskStop(canScrollLeft)} 0, black 20px, black calc(100% - 20px), ${maskStop(canScrollRight)} 100%)`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByPage('start')}
        aria-label={`${ariaLabel} — السابق`}
        tabIndex={canScrollRight ? 0 : -1}
        className={
          'absolute inset-y-0 start-0 z-10 hidden w-8 items-center justify-center border-e border-border bg-surface/90 text-fg outline-none transition-opacity duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex ' +
          (canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      >
        <ChevronRightIcon className="size-5" aria-hidden />
      </button>

      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        className="no-scrollbar flex snap-x snap-proximity items-center gap-5 overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage('end')}
        aria-label={`${ariaLabel} — التالي`}
        tabIndex={canScrollLeft ? 0 : -1}
        className={
          'absolute inset-y-0 end-0 z-10 hidden w-8 items-center justify-center border-s border-border bg-surface/90 text-fg outline-none transition-opacity duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex ' +
          (canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      >
        <ChevronLeftIcon className="size-5" aria-hidden />
      </button>
    </div>
  );
}
