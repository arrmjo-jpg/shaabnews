import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayParts, shiftYmd } from '@/lib/sport/day';

// فلتر الأيّام — نمط 365 (تنقّل تاريخ مُدمج، **مُوسَّط**). SSR بحت عبر روابط `?date=` (تحافظ على `?live=`):
// أمس/اليوم/غداً + سهمان للأبعد + تاريخ مختار أسفله مُوسَّطاً. لا تلفيق: يوم بلا مباريات يظهر بحالته الفارغة.
export function DayFilter({
  selected,
  today,
  basePath = '/sport',
  live = false,
}: {
  selected: string;
  today: string;
  basePath?: string;
  live?: boolean;
}) {
  const href = (ymd: string) => {
    const p = new URLSearchParams();
    if (ymd !== today) p.set('date', ymd);
    if (live) p.set('live', '1');
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const chips = [
    { ymd: shiftYmd(today, -1), label: 'أمس' },
    { ymd: today, label: 'اليوم' },
    { ymd: shiftYmd(today, 1), label: 'غداً' },
  ];
  const sel = dayParts(selected, today);

  return (
    <div dir="rtl" className="flex flex-col items-center gap-2 border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center justify-center gap-2">
        <Link
          href={href(shiftYmd(selected, -1))}
          aria-label="اليوم السابق"
          className="flex size-8 shrink-0 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ChevronRight className="size-4" />
        </Link>

        <div className="flex items-center gap-1">
          {chips.map((c) => {
            const active = c.ymd === selected;
            return (
              <Link
                key={c.ymd}
                href={href(c.ymd)}
                aria-current={active ? 'date' : undefined}
                className={
                  'px-3.5 py-1.5 text-[13px] font-bold transition-colors ' +
                  (active ? 'bg-primary text-white' : 'text-fg hover:bg-surface-2')
                }
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        <Link
          href={href(shiftYmd(selected, 1))}
          aria-label="اليوم التالي"
          className="flex size-8 shrink-0 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ChevronLeft className="size-4" />
        </Link>
      </div>

      <span className="text-[12px] font-medium text-muted">
        {sel.weekday} · {sel.date}
      </span>
    </div>
  );
}
