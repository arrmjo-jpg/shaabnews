'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import type { CompetitionInsightGame } from '@/lib/sport/domain/entities';

// سلايدر «أبرز التريندات» (نمط 365 top-trends-widget) — كروسل بطاقات بسهمين. كلّ بطاقة مباراة قادمة لها تريندات
// بارزة: موعد + لهبان (دلالة «بارز») + الفريقان (VS، شعارات، رابط للمباراة) + أسطر التريند البارزة (`text` إحصائيّ).
// **بلا أيّ مراهنات/odds/betCTA** (العقد). RTL: سهم يمين→البداية، سهم يسار→النهاية.
export function CompetitionInsightsSlider({ games }: { games: CompetitionInsightGame[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const nudge = (delta: number) => ref.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <div dir="rtl" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => nudge(320)}
        aria-label="السابق"
        className="flex shrink-0 items-center px-1 py-2 text-muted transition-colors hover:text-fg"
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={ref}
        className="flex flex-1 gap-3 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {games.map((g) => (
          <Link
            key={g.gameId}
            href={`/sport/match/${g.gameId}`}
            className="flex w-72 shrink-0 flex-col gap-3 border border-border p-3 transition-colors hover:border-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-muted">{g.dateShort}</span>
              <span className="text-xs" aria-label="تريند بارز" title="تريند بارز">
                🔥🔥
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[13px] font-bold text-fg">
              <span className="max-w-24 truncate">{g.home.name}</span>
              <Logo src={g.home.logo} />
              <span className="shrink-0 text-[10px] text-muted">VS</span>
              <Logo src={g.away.logo} />
              <span className="max-w-24 truncate">{g.away.name}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {g.trends.map((t) => (
                <li key={t.id} className="flex items-start gap-1.5 text-[11px] text-muted">
                  <span className="mt-1 size-1.5 shrink-0 bg-primary" aria-hidden />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => nudge(-320)}
        aria-label="التالي"
        className="flex shrink-0 items-center px-1 py-2 text-muted transition-colors hover:text-fg"
      >
        <ChevronLeft className="size-5" />
      </button>
    </div>
  );
}

function Logo({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
  return <img src={src} alt="" loading="lazy" className="size-4 shrink-0 object-contain" />;
}
