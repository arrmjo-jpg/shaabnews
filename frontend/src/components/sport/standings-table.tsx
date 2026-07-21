import Link from 'next/link';
import type { Standing } from '@/lib/sport/domain/entities';

// جدول الترتيب (نمط 365) — مركز + لون منطقة + شعار/اسم (+ تاج البطل) + لعب + له:عليه + فارق + نقاط + ف/ت/خ + آخر ٥.
// أعمدة متجاوبة (الجوّال = مركز/فريق/لعب/نقاط فقط ⇒ بلا سكرول). شارات الفورم روابط لصفحة المباراة. مربّع.
export function StandingsTable({
  data,
  showLegend = false,
  highlightIds,
  limit,
}: {
  data: Standing;
  showLegend?: boolean;
  highlightIds?: number[];
  limit?: number;
}) {
  const rows = typeof limit === 'number' ? data.rows.slice(0, limit) : data.rows;
  return (
    <div dir="rtl" className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted">
            <th className="px-1 py-2 text-center font-medium">#</th>
            <th className="px-2 py-2 text-start font-medium">الفريق</th>
            <th className="px-1 py-2 text-center font-medium">لعب</th>
            <th className="hidden px-1 py-2 text-center font-medium sm:table-cell">له:عليه</th>
            <th className="hidden px-1 py-2 text-center font-medium md:table-cell">فارق</th>
            <th className="px-1.5 py-2 text-center font-extrabold text-fg">نقاط</th>
            <th className="hidden px-1 py-2 text-center font-medium sm:table-cell">ف</th>
            <th className="hidden px-1 py-2 text-center font-medium sm:table-cell">ت</th>
            <th className="hidden px-1 py-2 text-center font-medium sm:table-cell">خ</th>
            <th className="hidden px-2 py-2 text-center font-medium lg:table-cell">آخر مباريات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.team.id}
              className={
                'border-b border-border last:border-b-0 ' +
                (highlightIds?.includes(r.team.id) ? 'bg-primary/10' : 'hover:bg-surface-2')
              }
            >
              <td className="px-1 py-2">
                <span className="flex items-center justify-center gap-1.5">
                  <span className="h-5 w-1 shrink-0" style={{ backgroundColor: r.zoneColor ?? 'transparent' }} aria-hidden />
                  <span className="tabular-nums text-muted">{r.rank}</span>
                </span>
              </td>
              <td className="px-2 py-2">
                <Link href={`/sport/team/${r.team.id}`} className="flex items-center gap-2">
                  {r.team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
                    <img src={r.team.logo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
                  ) : null}
                  <span className="truncate font-bold text-fg">{r.team.name}</span>
                  {r.isWinner && <span className="shrink-0 text-xs">🏆</span>}
                </Link>
              </td>
              <td className="px-1 py-2 text-center tabular-nums">{r.played}</td>
              <td className="hidden px-1 py-2 text-center tabular-nums text-muted sm:table-cell">
                <span dir="ltr">{r.goalsAgainst}:{r.goalsFor}</span>
              </td>
              <td className="hidden px-1 py-2 text-center tabular-nums md:table-cell">
                <span dir="ltr">{r.diff > 0 ? `+${r.diff}` : r.diff}</span>
              </td>
              <td className="px-1.5 py-2 text-center font-extrabold tabular-nums text-fg">{r.points}</td>
              <td className="hidden px-1 py-2 text-center tabular-nums sm:table-cell">{r.won}</td>
              <td className="hidden px-1 py-2 text-center tabular-nums sm:table-cell">{r.draw}</td>
              <td className="hidden px-1 py-2 text-center tabular-nums sm:table-cell">{r.lost}</td>
              <td className="hidden px-2 py-2 lg:table-cell">
                <span className="flex items-center justify-center gap-1">
                  {r.form.map((f, i) => (
                    <FormBadge key={i} outcome={f.outcome} gameId={f.gameId} />
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showLegend && data.zones.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-2 py-3 text-[11px] text-muted">
          {data.zones.map((z) => (
            <span key={z.name} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0" style={{ backgroundColor: z.color }} aria-hidden />
              {z.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const FORM: Record<number, { label: string; cls: string }> = {
  1: { label: 'ف', cls: 'bg-emerald-500 text-white' },
  2: { label: 'ت', cls: 'bg-zinc-400 text-white' },
  0: { label: 'خ', cls: 'bg-red-500 text-white' },
};

function FormBadge({ outcome, gameId }: { outcome: number; gameId: number | null }) {
  const v = FORM[outcome] ?? { label: '−', cls: 'bg-zinc-200 text-muted' };
  const badge = <span className={'flex size-5 items-center justify-center text-[10px] font-bold ' + v.cls}>{v.label}</span>;
  return gameId ? (
    <Link href={`/sport/match/${gameId}`} aria-label={v.label} className="transition-opacity hover:opacity-80">
      {badge}
    </Link>
  ) : (
    badge
  );
}
