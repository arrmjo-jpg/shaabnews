import Link from 'next/link';
import type { CompetitionInsightGame, CompetitionInsightsSummary } from '@/lib/sport/domain/entities';
import { CompetitionInsightsSlider } from './competition-insights-slider';

// «ملاحظات» البطولة (نمط 365 insights-page) — سلايدر «أبرز التريندات» (البارزة isTop) + قائمة «شائع» مُجمَّعة
// بالمباراة (ترويسة الفريقين رابطٌ للمباراة + أسطر التريند، لهب🔥 للبارز). كلّها إحصاءات واقعيّة من `text`،
// **مُجرَّدة تماماً من المراهنات/odds/betCTA** (العقد). الموعد مُهيّأ خادميّاً (لا منطق تاريخ في العميل).
export function CompetitionInsightsView({ data }: { data: CompetitionInsightsSummary }) {
  return (
    <div className="flex flex-col gap-6">
      {data.top.length > 0 && (
        <section dir="rtl" className="border border-border bg-surface">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-extrabold text-fg">أبرز التريندات</h2>
          </div>
          <div className="p-4">
            <CompetitionInsightsSlider games={data.top} />
          </div>
        </section>
      )}

      <section dir="rtl" className="border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-extrabold text-fg">شائع</h2>
        </div>
        <div className="divide-y divide-border">
          {data.all.map((g) => (
            <GameTrends key={g.gameId} g={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GameTrends({ g }: { g: CompetitionInsightGame }) {
  return (
    <div>
      <Link
        href={`/sport/match/${g.gameId}`}
        className="flex items-center gap-2 bg-surface-2 px-4 py-2.5 transition-colors hover:bg-border"
      >
        <Logo src={g.home.logo} />
        <span className="truncate text-[13px] font-bold text-fg">{g.home.name}</span>
        <span className="shrink-0 text-[10px] text-muted">VS</span>
        <Logo src={g.away.logo} />
        <span className="truncate text-[13px] font-bold text-fg">{g.away.name}</span>
        {g.dateLong && <span className="ms-auto shrink-0 text-[11px] text-muted">{g.dateLong}</span>}
      </Link>
      <ul>
        {g.trends.map((t) => (
          <li key={t.id} className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[13px] text-fg">
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.isTop && (
              <span className="shrink-0" title="تريند بارز" aria-label="تريند بارز">
                🔥
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Logo({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
  return <img src={src} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />;
}
