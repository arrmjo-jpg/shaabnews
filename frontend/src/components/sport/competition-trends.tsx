import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import type { FixtureTrend, MatchListItem } from '@/lib/sport/domain/entities';

// «الأكثر شيوعاً» (نمط 365 top-trends) — صفّ بطاقات أفقيّ، كلّ بطاقة مباراة قادمة: شارة موعد + مؤشّر ثقة (لهب من
// `percentage`) + الفريقان (VS، رابط للمباراة) + أسطر إحصائيّة واقعيّة (`text`). **مُجرَّد من المراهنات/odds/betCTA
// تماماً** (العقد). البطاقة كلّها رابط لصفحة المباراة. تُخفى البطولات بلا مباريات قادمة (بلا تلفيق).
export interface TrendCard {
  match: MatchListItem;
  trends: FixtureTrend[];
}

export function CompetitionTrends({ cards }: { cards: TrendCard[] }) {
  if (!cards.length) return null;
  return (
    <Card as="section" dir="rtl">
      <CardHeader>
        <h2 className="text-sm font-extrabold text-fg">الأكثر شيوعاً</h2>
      </CardHeader>
      <div className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:thin]">
        {cards.map((c) => (
          <Link
            key={c.match.id}
            href={`/sport/match/${c.match.id}`}
            className="sport-card flex w-72 shrink-0 snap-start flex-col gap-3 border border-border p-3 transition-colors hover:border-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-muted">{trendDay(c.match)}</span>
              <span className="text-xs" aria-label="مؤشّر الثقة">
                {flames(c.trends)}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[13px] font-bold text-fg">
              <span className="max-w-24 truncate">{c.match.home.name}</span>
              <TeamLogo src={c.match.home.logo} />
              <span className="shrink-0 text-[10px] text-muted">VS</span>
              <TeamLogo src={c.match.away.logo} />
              <span className="max-w-24 truncate">{c.match.away.name}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {c.trends.map((t, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted">
                  <span className="mt-1 size-1.5 shrink-0 bg-primary" aria-hidden />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function TeamLogo({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
  return <img src={src} alt="" loading="lazy" className="size-4 shrink-0 object-contain" />;
}

function flames(trends: FixtureTrend[]): string {
  const top = Math.max(0, ...trends.map((t) => t.percentage ?? 0));
  const n = top >= 0.9 ? 3 : top >= 0.75 ? 2 : 1;
  return '🔥'.repeat(n);
}

function trendDay(match: MatchListItem): string {
  if (!match.startTime) return '';
  try {
    const d = new Date(match.startTime);
    const ymd = (x: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
    if (ymd(d) === ymd(new Date()))
      return new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit' }).format(d);
    if (ymd(d) === ymd(new Date(Date.now() + 86_400_000))) return 'غدًا';
    return new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', day: '2-digit', month: '2-digit' }).format(d);
  } catch {
    return '';
  }
}
