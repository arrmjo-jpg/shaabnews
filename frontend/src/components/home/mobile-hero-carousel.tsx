'use client';

import { useEffect, useRef, useState } from 'react';

import type { FeedItem } from '@/lib/feed';

import { HeroCard } from './featured-hero';

const AUTOPLAY_MS = 5000;

// كاروسيل الهيرو للموبايل فقط — نمط خبرني.كوم/الجزيرة: بطاقة كبيرة واحدة قابلة للسحب (سكرول-سناب
// أصليّ، بلا مكتبة JS) بامتداد كامل الشاشة (بلا هوامش صفحة — يُعرَض خارج Container في
// featured-hero.tsx)، مع تشغيل تلقائي، تكبير Ken Burns بطيء للصورة النشطة، وعمق بصري (تصغير/تعتيم
// خفيف) للشرائح غير النشطة. على سطح المكتب هذا المكوّن لا يُستخدم إطلاقاً (FeaturedHero يبقي
// التخطيط القديم: كرت رئيسي + شبكة 2×2 — بلا أي تغيير هناك).
// scroll-snap بدل مكتبة كاروسيل: سحب لمسي أصيل من المتصفح، صفر إضافة حزمة جافاسكربت.
export function MobileHeroCarousel({ items }: { items: FeedItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تتبّع الشريحة المرئية حاليًا عبر IntersectionObserver لكل شريحة — أدقّ وأبسط من حساب
  // scrollLeft يدويًا (خصوصًا مع RTL، حيث تختلف إشارة scrollLeft بين المتصفحات).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = slideRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { root: track, threshold: [0.6] },
    );
    for (const el of slideRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items.length]);

  const goTo = (index: number) => {
    slideRefs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  // إيقاف مؤقت للتشغيل التلقائي عند أي تفاعل يدوي (سحب/سهم/نقطة)، يستأنف تلقائيًا بعد فترة خمول
  // قصيرة — بنمط ستوريز إنستغرام، لا يقاطع المستخدم وهو يتصفّح يدويًا.
  const pauseThenResume = () => {
    pausedRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
    }, 6000);
  };

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const current = slideRefs.current.findIndex((el, i) => i === active);
      const next = (current + 1) % items.length;
      goTo(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo/active عمداً: نعيد ضبط المؤقّت
    // بعد كل تغيّر شريحة (يدويّ أو تلقائيّ) بدل تراكم مؤقّتات متوازية.
  }, [items.length, active]);

  if (items.length === 0) return null;

  return (
    <div
      className="relative"
      onTouchStart={pauseThenResume}
      onPointerDown={pauseThenResume}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className={`w-full shrink-0 snap-start transition-[transform,opacity] duration-500 ease-out ${
              i === active ? 'carousel-slide-active scale-100 opacity-100' : 'scale-[0.97] opacity-80'
            }`}
          >
            {/* key يتغيّر مع تفعيل الشريحة فقط — يُعيد تركيب الصورة فيُعيد تشغيل Ken Burns من الصفر
                في كل مرة تصبح هذه الشريحة نشطة (لا أول تحميل فقط). */}
            <HeroCard key={i === active ? 'active' : 'idle'} item={item} variant="lead" priority={i === 0} cornerClassName="" />
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          {/* أسهم التنقّل — scrollIntoView على الشريحة الهدف (لا scrollBy) فيتفادى تمامًا مشكلة
              إشارة scrollLeft المتضاربة بين المتصفحات في حاويات RTL. carousel-pill بدل rounded-full:
              راجع globals.css — قاعدة "Square design" العامة تُسطّح rounded-full بلا هذا الاستثناء. */}
          <button
            type="button"
            aria-label="الشريحة السابقة"
            onClick={() => {
              goTo(Math.max(0, active - 1));
              pauseThenResume();
            }}
            disabled={active === 0}
            className="carousel-pill absolute start-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-md transition-opacity active:scale-95 disabled:opacity-0"
          >
            <span aria-hidden className="text-xl leading-none">‹</span>
          </button>
          <button
            type="button"
            aria-label="الشريحة التالية"
            onClick={() => {
              goTo(Math.min(items.length - 1, active + 1));
              pauseThenResume();
            }}
            disabled={active === items.length - 1}
            className="carousel-pill absolute end-3 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-md transition-opacity active:scale-95 disabled:opacity-0"
          >
            <span aria-hidden className="text-xl leading-none">›</span>
          </button>

          {/* نقاط التنقّل — تتحوّل النقطة النشطة لشريط تقدّم صغير يمتلئ بمدّة التشغيل التلقائي،
              بنمط ستوريز إنستغرام/الجزيرة، بدل نقطة ثابتة بلا حركة. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5 px-4"
            role="tablist"
            aria-label="شرائح الأخبار المميّزة"
          >
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`الشريحة ${i + 1}`}
                onClick={() => {
                  goTo(i);
                  pauseThenResume();
                }}
                className={`carousel-pill pointer-events-auto relative h-1.5 overflow-hidden bg-white/35 backdrop-blur-sm transition-all duration-300 ${
                  i === active ? 'w-8' : 'w-1.5'
                }`}
              >
                {i === active && (
                  <span
                    key={`progress-${active}`}
                    className="carousel-pill carousel-progress-fill absolute inset-y-0 start-0 bg-white"
                    style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
