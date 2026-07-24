import type { PreGameComparison } from '@/lib/sport/domain/entities';

// مقارنة ما قبل المباراة (نمط 365 pre-game-stats) — مجموعات (كل المسابقات % + معدّل الإحصائيات)، كلّ صفّ ثلاثيّ:
// قيمة المضيف (يمين) · اسم المقياس (وسط) · قيمة الضيف (يسار). القيمة المظلَّلة (`marked`) تأخذ لون الفريق.
export function MatchPreGameStats({
  data,
  homeColor,
  awayColor,
}: {
  data: PreGameComparison;
  homeColor: string | null;
  awayColor: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {data.groups.map((g, gi) => (
        <section key={gi} dir="rtl" className="border border-border bg-surface">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-extrabold text-fg">{g.title}</h2>
          </div>
          {(data.homeText || data.awayText) && (
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-1.5 text-[11px] font-bold text-muted">
              <span>{data.homeText}</span>
              <span>{data.awayText}</span>
            </div>
          )}
          <ul className="divide-y divide-border">
            {g.rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 px-3 py-2">
                <Chip value={r.home} marked={r.marked === 'home'} color={homeColor} />
                <span className="text-center text-[12px] leading-tight text-muted">{r.name}</span>
                <Chip value={r.away} marked={r.marked === 'away'} color={awayColor} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Chip({ value, marked, color }: { value: string; marked: boolean; color: string | null }) {
  if (!marked || !color) {
    return <span className="text-center text-[13px] font-bold tabular-nums text-fg">{value}</span>;
  }
  const lum = luminance(color);
  const onDark = lum != null && lum <= 0.6; // لون داكن ⇒ نصّ أبيض؛ فاتح/أبيض (كالسنغال) ⇒ نصّ داكن + حدّ ليظهر
  return (
    <span
      className="mx-auto flex min-w-[3.25rem] items-center justify-center border border-border px-2 py-0.5 text-[13px] font-extrabold tabular-nums"
      style={{ backgroundColor: color, color: onDark ? '#ffffff' : '#15202b' }}
    >
      {value}
    </span>
  );
}

function luminance(hex: string | null): number | null {
  if (!hex) return null;
  const h = hex.replace('#', '').trim();
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (f.length !== 6) return null;
  const r = parseInt(f.slice(0, 2), 16);
  const g = parseInt(f.slice(2, 4), 16);
  const b = parseInt(f.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
