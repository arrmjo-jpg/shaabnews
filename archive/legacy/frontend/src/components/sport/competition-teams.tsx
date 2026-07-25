import type { TeamLite } from '@/lib/sport/stats';

// تبويب «الفرق» — شبكة بطاقات (شعار + اسم) لفِرَق البطولة. مربّع؛ شعارات تُعرض كما هي (contain). لا تلفيق.
export function CompetitionTeams({ teams }: { teams: TeamLite[] }) {
  if (!teams.length) {
    return <div className="border border-border bg-surface p-8 text-center text-sm text-muted">لا فرق متاحة.</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {teams.map((t) => (
        <div key={t.id} dir="rtl" className="flex items-center gap-2.5 border border-border bg-surface px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden">
            {t.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
              <img src={t.logo} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
            ) : null}
          </span>
          <span className="truncate text-sm font-bold text-fg">{t.name}</span>
        </div>
      ))}
    </div>
  );
}
