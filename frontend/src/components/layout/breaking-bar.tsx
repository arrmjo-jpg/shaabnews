'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { FeedItem } from '@/lib/feed';

// شريط الأخبار العاجلة — منقول من مشروع gasem (breaking-news-bar.tsx)، مكيَّف مع رموز تصميم
// shaabjo (bg-primary/text-primary-foreground بدل الأحمر الثابت #b90000) ونمط الـMarquee الحالي
// (يعيد استخدام مسار الحركة ase-ticker-scroll من economy/ase-market-bar.tsx، انظر globals.css).
//  • سطح المكتب (lg وما فوق، 1024px): شريط ثابت (fixed) ملتصق بأسفل الشاشة دائمًا أثناء التمرير —
//    مسرح يعرض خبرًا واحدًا يتبدّل كل ٥ث (فيد+انزلاق)، مع أزرار مشاركة واتساب/فيسبوك وزرّ إغلاق.
//  • الجوّال/التابلت (دون lg): يبقى بمكانه الحالي تحت الهيدر (في التدفّق العاديّ) — Marquee متصل
//    لكلّ العناوين معًا، بلا مسرح/مشاركة/زرّ إغلاق (يطابق قرار gasem: المودال المنبثق المذكور في
//    تعليق الملف الأصلي لم يُنفَّذ فعليًّا هناك، فلم يُنقل هنا).
//  • نقطة التحوّل lg (وليس md) عمدًا: تطابق نفس حدّ "الديسكتوب" الذي يخفي عنده mobile-bottom-nav
//    (lg:hidden) — لو استُخدم md لتداخل الشريطان الثابتان أسفل الشاشة بين 768-1023px.
// لا عاجل ⇒ لا شيء (بلا placeholder). يحترم prefers-reduced-motion (عبر CSS في globals.css).
export interface BreakingBarProps {
  items: Pick<FeedItem, 'id' | 'title' | 'href'>[];
}

const WHATSAPP_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
const FACEBOOK_PATH = 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z';

export function BreakingBar({ items }: BreakingBarProps) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [origin, setOrigin] = useState('');
  const [paused, setPaused] = useState(false);
  const [desktopPaused, setDesktopPaused] = useState(false);

  // بعد التركيب: أصل الرابط (لروابط المشاركة) — عميليّ بحت لتفادي اختلاف SSR/CSR.
  useEffect(() => {
    if (items.length === 0) return;
    setOrigin(window.location.origin);
  }, [items.length]);

  // تدوير العناوين كل ٥ ثوانٍ (سطح المكتب فقط بصريًّا، لكن المنطق مشترك لبساطة الحالة).
  // يتوقّف طول ما الموس فوق المسرح (desktopPaused) — تفريغ الفاصل الزمني بدل تركه شغّالًا.
  useEffect(() => {
    if (items.length <= 1 || desktopPaused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length, desktopPaused]);

  if (items.length === 0 || !open) return null;

  const shareUrl = (href: string) => (origin ? origin + href : href);
  const loop = [...items, ...items];

  return (
    <div
      className="breaking-bar flex h-12 items-stretch overflow-hidden bg-primary text-primary-foreground lg:fixed lg:inset-x-0 lg:bottom-0 lg:z-40 lg:h-14"
      aria-label="أخبار عاجلة"
    >
      {/* شارة «عاجل» بيضاء مع حافة مائلة تنفذ في لون الأساس */}
      <div className="breaking-badge relative z-10 flex shrink-0 items-center bg-surface px-3 sm:px-6">
        <span className="text-3xl font-black tracking-tight text-primary motion-safe:animate-pulse lg:text-2xl">عاجل</span>
        <span className="breaking-badge-skew absolute inset-y-0 bg-surface" aria-hidden />
      </div>

      {/* مسرح العناوين — خبر واحد ظاهر، يتلاشى/ينزلق عند التبديل — سطح المكتب فقط */}
      <div
        className="relative hidden min-w-0 flex-1 lg:block"
        onMouseEnter={() => setDesktopPaused(true)}
        onMouseLeave={() => setDesktopPaused(false)}
      >
        {items.map((it, i) => (
          <div
            key={it.id}
            data-active={i === index}
            className="breaking-slide absolute inset-0 flex items-center justify-between gap-4 px-6"
            aria-hidden={i !== index}
          >
            <Link
              href={it.href}
              className="min-w-0 flex-1 truncate text-lg font-black transition-colors hover:text-primary-foreground/80"
              tabIndex={i === index ? 0 : -1}
            >
              {it.title}
            </Link>
            {origin && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-[11px] font-black text-primary-foreground/60 xl:inline">شارك:</span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${it.title} ${shareUrl(it.href)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="مشاركة عبر واتساب"
                  className="flex size-9 shrink-0 items-center justify-center bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20 transition-colors hover:bg-primary-foreground hover:text-primary"
                  tabIndex={i === index ? 0 : -1}
                >
                  <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                    <path d={WHATSAPP_PATH} />
                  </svg>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl(it.href))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="مشاركة عبر فيسبوك"
                  className="flex size-9 shrink-0 items-center justify-center bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20 transition-colors hover:bg-primary-foreground hover:text-primary"
                  tabIndex={i === index ? 0 : -1}
                >
                  <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                    <path d={FACEBOOK_PATH} />
                  </svg>
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Marquee متصل لكلّ العناوين معًا — الجوّال فقط. نافذة dir=ltr لتثبيت المسار يسارًا (تصحيح
          RTL، انظر التعليق المطابق في ase-market-bar.tsx)، والمسار نفسه يعيد استخدام حركة
          ase-ticker-scroll المعرَّفة في globals.css. */}
      <div
        className="breaking-marquee-viewport relative flex min-w-0 flex-1 items-center overflow-hidden lg:hidden"
        dir="ltr"
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onTouchCancel={() => setPaused(false)}
      >
        <div
          className="breaking-marquee-track absolute inset-y-0 left-0 flex w-max items-center"
          style={{
            animationDuration: `${Math.max(16, items.length * 5)}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {loop.map((it, i) => (
            <span key={`${it.id}-${i}`} className="flex items-center whitespace-nowrap px-4 text-sm font-black" dir="rtl">
              <Link href={it.href} className="transition-colors hover:text-primary-foreground/80" tabIndex={i < items.length ? 0 : -1}>
                {it.title}
              </Link>
              <span className="ps-4 text-primary-foreground/50" aria-hidden>
                •
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* زرّ الإغلاق — سطح المكتب فقط (يطابق إخفاء المسرح/المشاركة على الجوّال) */}
      <button
        onClick={() => setOpen(false)}
        className="hidden shrink-0 items-center border-s border-primary-foreground/20 px-4 transition-colors hover:bg-primary-foreground/10 lg:flex"
        aria-label="إغلاق شريط العاجل"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
