import Link from 'next/link';
import { StandingsTable } from '@/components/sport/standings-table';
import { getStandings } from '@/lib/sport/stats';

// كتلة «ترتيب الدوري» للرئيسية (تحت الأخبار، نمط 365 standingsPreview) — ترويسة + جدول كامل + رابط الصفحة الداخليّة.
// المصدر web/standings؛ لا بيانات (كأس/خارج موسم) ⇒ تُخفى (لا تلفيق). server-only via getStandings.
export async function StandingsBlock({ competitionId }: { competitionId: number }) {
  const data = await getStandings(competitionId);
  if (!data || data.rows.length === 0) return null;

  return (
    <section dir="rtl" className="border border-border bg-surface" aria-labelledby="standings-block-heading">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {data.competition.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
          <img src={data.competition.logo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
        )}
        <h2 id="standings-block-heading" className="text-sm font-extrabold text-fg">
          ترتيب {data.competition.name}
        </h2>
      </div>

      <div className="px-2">
        <StandingsTable data={data} />
      </div>

      <Link
        href={`/sport/competition/${data.competition.id}?tab=standings`}
        className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
      >
        ترتيب {data.competition.name} الكامل
      </Link>
    </section>
  );
}
