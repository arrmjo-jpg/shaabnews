'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import type { MatchSide, SportMatch } from '@/lib/sport/games';

// شريط نتائج أفقيّ (كاروسيل) — نتائج/جدول البطولة، بطاقة لكلّ مباراة (شعار+اسم فريق × 2 حول
// النتيجة/الحالة) + سهما تنقّل عند الطرفين. يجلس مباشرةً تحت الهيدر الرئيسيّ للموقع (site layout)،
// يظهر في كلّ صفحات الموقع. كلّ بطاقة رابط لصفحة تفاصيل المباراة. بيانات حقيقيّة فقط
// (365Scores عبر lib/sport/games.ts) — بلا تلفيق.
export function LeagueMatchesTicker({ matches }: { matches: SportMatch[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // الترتيب زمنيّ تصاعديّ (نتائج سابقة أوّلاً)، فبلا هذا التمرير الأوّليّ يرى الزائر النتائج
  // المنتهية فقط في نافذة عرض ضيّقة، والمباريات المباشرة/القادمة تتطلّب تمريرًا يدويًّا ليكتشفها.
  // نمرّر تلقائيًّا (بلا حركة) إلى أوّل مباراة مباشرة/قادمة عند التحميل — أو آخر عنصر إن كانت كلّها منتهية.
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

  // RTL: البداية يمين، النهاية يسار. «السابق» (يمين) يعيد للخلف نحو بداية القائمة، «التالي»
  // (يسار) يتقدّم نحو نهايتها — بصريًّا scrollLeft يتناقص مع التقدّم في محتوى RTL.
  const scrollByPage = (direction: 'prev' | 'next') => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === 'next' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div dir="rtl" className="relative border-b border-border bg-surface">
      <button
        type="button"
        onClick={() => scrollByPage('prev')}
        aria-label="المباراة السابقة"
        className="absolute inset-y-0 start-0 z-10 hidden w-9 items-center justify-center border-e border-border bg-surface/95 text-fg transition-colors hover:text-primary lg:flex"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div ref={scrollerRef} className="scrollbar-none flex overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {matches.map((match) => (
          <TickerCard key={match.id} match={match} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByPage('next')}
        aria-label="المباراة التالية"
        className="absolute inset-y-0 end-0 z-10 hidden w-9 items-center justify-center border-s border-border bg-surface/95 text-fg transition-colors hover:text-primary lg:flex"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function TickerCard({ match }: { match: SportMatch }) {
  const hasScore = match.home.score !== null && match.away.score !== null;

  return (
    <Link
      href={`/sport/match/${match.id}`}
      className="grid shrink-0 grid-cols-3 items-center gap-2 border-e border-border px-4 py-2.5 transition-colors last:border-e-0 hover:bg-surface-2"
    >
      <TeamBlock side={match.home} />

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

      <TeamBlock side={match.away} />
    </Link>
  );
}

function TeamBlock({ side }: { side: MatchSide }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار 365 من CDN
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

function statusLabel(match: SportMatch): string {
  if (match.kind === 'live') return match.minute ?? 'مباشر';
  if (match.kind === 'finished') return match.statusText ?? 'انتهت المباراة';

  return match.statusText ?? 'لم تبدأ بعد';
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
}
