'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import type { PlayerCompetitionRef } from '@/lib/sport/domain/entities';

// محوّل بطولات اللاعب (نمط 365 horizontal-arrows-menu-bar) — **كروسل بسهمين** يُمرّر شريط البطولات، لا تمرير حرّ.
// كلّ عنصر رابط `?competitionId=` (يحفظ التبويب). RTL: سهم يمين→نحو البداية، سهم يسار→نحو النهاية.
export function CompetitionCarousel({
  competitions,
  activeId,
  baseHref,
}: {
  competitions: PlayerCompetitionRef[];
  activeId: number | null;
  baseHref: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nudge = (delta: number) => ref.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <div dir="rtl" className="flex items-center border-b border-border">
      <button
        type="button"
        onClick={() => nudge(220)}
        aria-label="السابق"
        className="flex shrink-0 items-center px-1.5 py-2 text-muted transition-colors hover:text-fg"
      >
        <ChevronRight className="size-4" />
      </button>

      <div
        ref={ref}
        className="flex flex-1 gap-2 overflow-x-auto scroll-smooth py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {competitions.map((c) => (
          <Link
            key={c.id}
            href={`${baseHref}&competitionId=${c.id}`}
            aria-current={c.id === activeId ? 'true' : undefined}
            className={
              'flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-bold transition-colors ' +
              (c.id === activeId ? 'border-primary text-primary' : 'border-border text-muted hover:text-fg')
            }
          >
            {c.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- شعار بطولة 365 من CDN
              <img src={c.logo} alt="" loading="lazy" className="size-4 shrink-0 object-contain" />
            )}
            {c.name}
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => nudge(-220)}
        aria-label="التالي"
        className="flex shrink-0 items-center px-1.5 py-2 text-muted transition-colors hover:text-fg"
      >
        <ChevronLeft className="size-4" />
      </button>
    </div>
  );
}
