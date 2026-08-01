'use client';

import Link from 'next/link';
import { useRef } from 'react';

import type { FeedItem } from '@/lib/feed';

// كاروسيل كتّاب الرأي — يمرّر بطاقة واحدة بالضبط لكل ضغطة (يقيس عرض أوّل بطاقة + الفجوة وقت
// الضغط، لا مسافة ثابتة). نفس تصميم أسهم كاروسيل الريلز في الرئيسية (دائرية حمراء، تظهر عند
// المرور بالماوس، يمين=السابق يسار=التالي RTL).
export function OpinionWritersCarousel({ items }: { items: FeedItem[] }) {
  const stripRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const strip = stripRef.current;
    const card = strip?.firstElementChild as HTMLElement | null;
    if (!strip || !card) return;
    const gap = parseFloat(getComputedStyle(strip).columnGap || '16');
    const step = card.getBoundingClientRect().width + gap;
    strip.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="group/strip relative">
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="السابق"
        className="absolute -start-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center bg-primary text-primary-foreground opacity-0 shadow-md transition group-hover/strip:opacity-100 sm:flex"
        style={{ borderRadius: '9999px' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="التالي"
        className="absolute -end-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center bg-primary text-primary-foreground opacity-0 shadow-md transition group-hover/strip:opacity-100 sm:flex"
        style={{ borderRadius: '9999px' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div
        ref={stripRef}
        className="flex gap-x-4 gap-y-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <WriterCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function WriterCard({ item }: { item: FeedItem }) {
  // الصورة: غلاف المقال (متمايز) ثمّ صورة الكاتب احتياطاً.
  const photo = item.image ?? item.author?.avatar ?? null;
  const author = item.author;
  // اسم الكاتب يفتح بروفيله **فقط إن كان كاتباً مفعّلاً** (id + isWriter)؛ غير المفعّل/المدير ⇒ نصّ.
  const writerHref =
    author?.isWriter && author.id ? `/news/writer/${author.id}${author.slug ? `-${author.slug}` : ''}` : null;

  return (
    <div className="flex w-[calc((100%-2rem)/3)] shrink-0 flex-col items-center text-center lg:w-[calc((100%-5rem)/6)]">
      {/* رابط المقال — يغطّي الصورة والعنوان فقط (ليس اسم الكاتب) */}
      <Link href={item.href} className="group block w-full">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2" style={{ borderRadius: '12px' }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
            <img
              src={photo}
              alt={item.imageAlt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="size-full bg-surface-3" aria-hidden />
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-focus-visible:underline">
          {item.title}
        </h3>
      </Link>

      {/* اسم الكاتب — رابط بروفيل مستقلّ (كاتب مفعّل) أو نصّ (غيره) */}
      {author?.name &&
        (writerHref ? (
          <Link href={writerHref} className="mt-1 text-xs font-bold text-primary hover:underline">
            {author.name}
          </Link>
        ) : (
          <span className="mt-1 text-xs text-muted">{author.name}</span>
        ))}
    </div>
  );
}
