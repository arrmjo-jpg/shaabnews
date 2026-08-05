'use client';

import { useEffect, useRef, useState } from 'react';

import type { FeedItem } from '@/lib/feed';

import { HeroCard } from './featured-hero';

const AUTOPLAY_MS = 5000;

// كاروسيل الهيرو للموبايل فقط — نمط خبرني.كوم: بطاقة كبيرة واحدة قابلة للسحب (سكرول-سناب أصليّ،
// بلا مكتبة JS)، داخل هوامش الصفحة العادية (لا امتداد كامل الشاشة)، بزوايا مدوّرة، أسهم دائريّة
// شبه-شفّافة، ونقاط تنقّل بسيطة أسفل البطاقة. تشغيل تلقائي + تكبير Ken Burns بطيء للصورة النشطة
// لمسة حيويّة إضافية بلا تعارض مع النمط المرجعي. على سطح المكتب هذا المكوّن لا يُستخدم إطلاقاً
// (FeaturedHero يبقي التخطيط القديم: كرت رئيسي + شبكة 2×2 — بلا أي تغيير هناك).
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

  // تمرير أفقيّ داخل المسار حصرًا — لا scrollIntoView: تلك تُصعِّد أحيانًا إلى تمرير الصفحة
  // الرأسيّ كاملةً حتى نافذة العرض (window) لإعادة إظهار الشريحة، فيُرجع المستخدم لأعلى الصفحة
  // كل خمس ثوانٍ (كل تبديل تلقائيّ) — خلل مُبلَّغ عنه. الفرق بين حافّتي الشريحة والمسار (بالبكسل
  // الفعليّ من getBoundingClientRect) يعمل صحيحًا LTR/RTL كليهما بلا الحاجة لمعرفة إشارة
  // scrollLeft (موجب/سالب) التي تختلف بين المتصفحات في RTL — نفس السبب الذي دفع لتفادي scrollBy
  // المباشر سابقًا، لكن هنا القيمة مُشتقّة نسبيًّا من bounding rects لا من scrollLeft المطلق.
  const goTo = (index: number) => {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) return;
    const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // إيقاف مؤقت للتشغيل التلقائي عند أي تفاعل يدوي (سحب/سهم/نقطة)، يستأنف تلقائيًا بعد فترة خمول
  // قصيرة — لا يقاطع المستخدم وهو يتصفّح يدويًا.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active عمداً: نعيد ضبط المؤقّت بعد
    // كل تغيّر شريحة (يدويّ أو تلقائيّ) بدل تراكم مؤقّتات متوازية.
  }, [items.length, active]);

  if (items.length === 0) return null;

  return (
    <div className="relative" onTouchStart={pauseThenResume} onPointerDown={pauseThenResume}>
      <div
        ref={trackRef}
        className="carousel-card-frame flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="w-full shrink-0 snap-start"
          >
            {/* key يتغيّر مع تفعيل الشريحة فقط — يُعيد تركيب الصورة فيُعيد تشغيل Ken Burns من الصفر
                في كل مرة تصبح هذه الشريحة نشطة (لا أول تحميل فقط). */}
            <HeroCard
              key={i === active ? 'active' : 'idle'}
              item={item}
              variant="lead"
              priority={i === 0}
              cornerClassName={i === active ? 'carousel-slide-active' : ''}
            />
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          {/* أسهم دائريّة حمراء (bg-primary) بحجم أكبر يناسب اللمس (48px) — carousel-pill بدل
              rounded-full: راجع globals.css، قاعدة "Square design" العامة تُسطّح rounded-full بلا
              هذا الاستثناء. goTo أعلاه تُمرِّر المسار حصرًا (راجع تعليقها) — لا تأثير على تمرير
              الصفحة هنا. */}
          {/* الأسهم تدور بلا توقّف (نفس منطق التشغيل التلقائي % items.length) — لا تعطيل/اختفاء
              عند أوّل/آخر شريحة؛ الوصول لآخر خبر يُعيد للأوّل بدل توقّف السهم. */}
          <button
            type="button"
            aria-label="الشريحة السابقة"
            onClick={() => {
              goTo((active - 1 + items.length) % items.length);
              pauseThenResume();
            }}
            className="carousel-pill absolute start-3 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center bg-primary text-white shadow-lg transition-colors hover:bg-primary/90 active:scale-95"
          >
            <span aria-hidden className="text-2xl leading-none">‹</span>
          </button>
          <button
            type="button"
            aria-label="الشريحة التالية"
            onClick={() => {
              goTo((active + 1) % items.length);
              pauseThenResume();
            }}
            className="carousel-pill absolute end-3 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center bg-primary text-white shadow-lg transition-colors hover:bg-primary/90 active:scale-95"
          >
            <span aria-hidden className="text-2xl leading-none">›</span>
          </button>

          {/* نقاط تنقّل بسيطة (بلا شريط تقدّم) — النشطة أكبر وأكثر تباينًا، الباقي صغير شبه-شفّاف. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5"
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
                className={`carousel-pill pointer-events-auto transition-all duration-300 ${
                  i === active ? 'size-2.5 bg-white' : 'size-2 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
