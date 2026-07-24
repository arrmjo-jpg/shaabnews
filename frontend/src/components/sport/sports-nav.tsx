import type { SVGProps } from 'react';
import Link from 'next/link';

import {
  BasketballIcon,
  FootballIcon,
  HandballIcon,
  TennisIcon,
  VolleyballIcon,
} from '@/components/sport/sport-icons';
import { SPORTS, sportHref } from '@/lib/sport/sports';

// منيو الرياضات — **ضمن الحاوية**، بلاطات بطاقيّة فعليّة (روابط) data-driven من `SPORTS` (لا تكرار).
// النشط = أحمر ممتلئ بظلّ؛ الخامل = أبيض، عند المرور **حركة كالبطاقات** (رفع + ظلّ + تكبير الأيقونة). بوّابة عوالم القسم.
const ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  football: FootballIcon,
  basketball: BasketballIcon,
  tennis: TennisIcon,
  handball: HandballIcon,
  volleyball: VolleyballIcon,
};

export function SportsNav({ active }: { active: string }) {
  return (
    <nav dir="rtl" aria-label="الرياضات" className="flex gap-2.5 overflow-x-auto pb-1">
      {SPORTS.map((s) => {
        const Icon = ICONS[s.key] ?? FootballIcon;
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={sportHref(s)}
            aria-current={isActive ? 'page' : undefined}
            className={
              'group flex min-w-[84px] flex-1 flex-col items-center justify-center gap-2 border px-4 py-3.5 transition-all duration-200 ' +
              (isActive
                ? 'border-primary bg-primary text-white shadow-md'
                : 'border-border bg-surface text-muted hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-md')
            }
          >
            <Icon className="size-6 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="whitespace-nowrap text-[13px] font-bold">{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
