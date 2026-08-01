import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import type { MatchTrendsSummary } from '@/lib/sport/domain/entities';

// «شائع» لصفحة المباراة (نمط 365 trends-widget) — قسم «أفضل تريند» (مظلَّل بشعار الفريق) + قسم «شائع» مُجمَّع بالفريق
// (شعار+اسم رابط للفريق + قائمة تريندات إحصائيّة، 🔥 للعالية). مُجرَّد تماماً من «X يفوز»/odds (العقد).
export function MatchTrendsView({ data }: { data: MatchTrendsSummary }) {
  return (
    <div className="flex flex-col gap-6">
      {data.top && data.top.lines.length > 0 && (
        <Card as="section" dir="rtl">
          <CardHeader>
            <h2 className="text-sm font-extrabold text-fg">أفضل تريند</h2>
          </CardHeader>
          <div className="flex items-center gap-3 p-4">
            {data.top.teamLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
              <img src={data.top.teamLogo} alt="" loading="lazy" className="size-10 shrink-0 object-contain" />
            )}
            <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
              {data.top.lines.map((l, i) => (
                <li key={i} className="text-[13px] font-bold text-fg">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card as="section" dir="rtl">
        <CardHeader>
          <h2 className="text-sm font-extrabold text-fg">شائع</h2>
        </CardHeader>
        {data.teams.map((team) => (
          <div key={team.teamId ?? team.teamName} className="border-b border-border last:border-b-0">
            <TeamHeader id={team.teamId} name={team.teamName} logo={team.teamLogo} />
            <ul>
              {team.trends.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[13px] text-fg"
                >
                  <span className="min-w-0 flex-1">{t.text}</span>
                  {t.flame && (
                    <span className="shrink-0" title="تريند قويّ" aria-label="تريند قويّ">
                      🔥
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

function TeamHeader({ id, name, logo }: { id: number | null; name: string | null; logo: string | null }) {
  const inner = (
    <>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
        <img src={logo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
      )}
      <span className="truncate text-[13px] font-extrabold text-fg">{name || '—'}</span>
    </>
  );
  return id ? (
    <Link href={`/sport/team/${id}`} className="flex items-center gap-2 bg-surface-2 px-4 py-2 transition-colors hover:bg-border">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-2 bg-surface-2 px-4 py-2">{inner}</div>
  );
}
