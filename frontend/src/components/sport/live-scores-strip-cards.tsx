'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Card } from '@/components/ui/card';
import type { Match, MatchSideSummary } from '@/lib/sport/domain/entities';

// طبقة العرض التفاعلية للـLive Scores Strip — عرض جديد بالكامل، ليس استيرادًا لـ
// LeagueMatchesTicker (قرار Phase 2: نمط العرض فقط قابل للاقتداء به، لا الكود/النوع نفسه —
// LeagueMatchesTicker يستورد SportMatch من games.ts مباشرة، ما يخالف §34 لو استُورِد هنا).
// أنواع Domain فقط (Match/MatchSideSummary من domain/entities)، لا games.ts إطلاقًا.
export function LiveScoresStripCards({ matches }: { matches: Match[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // نفس منطق التمرير الأوّلي المُثبَت في LeagueMatchesTicker: أوّل مباراة غير منتهية، أو آخر
  // عنصر إن كانت كلّها منتهية — بلا حركة، عند التحميل فقط.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || matches.length === 0) return;
    const targetIndex = matches.findIndex((m) => m.kind !== 'finished');
    const idx = targetIndex === -1 ? matches.length - 1 : targetIndex;
    const card = el.children[idx];
    card?.scrollIntoView({ inline: 'center', behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند تحميل هذه المجموعة فقط، لا عند كل إعادة رسم
  }, [matches.length]);

  if (matches.length === 0) return null;

  const scrollByPage = (direction: 'prev' | 'next') => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === 'next' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <Card className="relative" dir="rtl">
      <button
        type="button"
        onClick={() => scrollByPage('prev')}
        aria-label="المباراة السابقة"
        className="absolute inset-y-0 start-0 z-10 hidden w-9 items-center justify-center border-e border-border bg-surface/95 text-fg transition-colors hover:text-primary lg:flex"
      >
        <ChevronRightIcon className="size-5" aria-hidden />
      </button>

      <div ref={scrollerRef} className="scrollbar-none flex overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {matches.map((match) => (
          <StripCard key={match.id} match={match} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage('next')}
        aria-label="المباراة التالية"
        className="absolute inset-y-0 end-0 z-10 hidden w-9 items-center justify-center border-s border-border bg-surface/95 text-fg transition-colors hover:text-primary lg:flex"
      >
        <ChevronLeftIcon className="size-5" aria-hidden />
      </button>
    </Card>
  );
}

function StripCard({ match }: { match: Match }) {
  const hasScore = match.home.score !== null && match.away.score !== null;

  return (
    <Link
      href={`/sport/match/${match.id}`}
      className="flex shrink-0 flex-col gap-1.5 border-e border-border px-4 py-2.5 transition-colors last:border-e-0 hover:bg-surface-2"
    >
      {match.competition && (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          {match.competitionLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- شعار بطولة من CDN
            <img src={match.competitionLogo} alt="" loading="lazy" decoding="async" className="size-3.5 shrink-0 object-contain" />
          ) : null}
          <span className="max-w-24 truncate">{match.competition}</span>
        </span>
      )}

      <div className="grid grid-cols-3 items-center gap-2">
        <SideBlock side={match.home} />

        <div className="flex flex-col items-center justify-center gap-1">
          {hasScore ? (
            <span className="flex items-center gap-1 text-xl font-extrabold tabular-nums text-fg">
              <span>{match.home.score}</span>
              <span className="text-muted">-</span>
              <span>{match.away.score}</span>
            </span>
          ) : (
            <span className="text-xl font-extrabold text-fg">{formatTime(match.startTime)}</span>
          )}
          <span className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-center text-[11px] font-medium text-muted">
            {statusLabel(match)}
          </span>
        </div>

        <SideBlock side={match.away} />
      </div>
    </Link>
  );
}

function SideBlock({ side }: { side: MatchSideSummary }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق من CDN
        <img src={side.logo} alt="" loading="lazy" decoding="async" className="size-8 shrink-0 object-contain" />
      ) : (
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ backgroundColor: side.color ?? '#9aa0a6' }}
          aria-hidden
        >
          {(side.name || '?').slice(0, 1)}
        </span>
      )}
      <span className="w-full truncate text-center text-xs font-medium text-fg">{side.name || '—'}</span>
    </div>
  );
}

function statusLabel(match: Match): string {
  if (match.kind === 'live') return match.minute ?? 'مباشر';
  if (match.kind === 'finished') return match.statusText ?? 'انتهت المباراة';

  return match.statusText ?? 'لم تبدأ بعد';
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }).format(new Date(iso));
  } catch {
    return '';
  }
}
