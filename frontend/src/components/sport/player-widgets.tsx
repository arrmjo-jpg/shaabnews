import Link from 'next/link';
import type { PlayerCareerSection, PlayerRecentMatch, PlayerTrophy } from '@/lib/sport/domain/entities';

// مكوّنات صفحة اللاعب (نمط 365 athlete-widget) — تُعرَض دائمًا (هيكل 365)، وتملأ ببيانات 365 الفعليّة أو حالة فارغة صادقة.

// «المباريات الأخيرة» (نمط 365) — صفّ مرتّب: [تاريخ] [فريقان بعرض ثابت] [نتيجة ملتصقة] [دقائق/أهداف] … [تقييم يسار].
// الفرق بعرض ثابت كي تلتصق النتيجة بالاسم (لا تتمدّد فجوة)، و`flex-1` يدفع التقييم لأقصى اليسار كـ365.
export function PlayerLastMatches({ matches, moreHref }: { matches: PlayerRecentMatch[]; moreHref?: string }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">المباريات الأخيرة</h2>
      </div>
      {matches.length > 0 ? (
        <>
          <div>
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/sport/match/${m.id}`}
                className="flex items-center gap-3 border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                {/* الترتيب (يمين→يسار): تاريخ · فريقان · نتيجة · دقائق · أهداف · تقييم — كما 365 */}
                <time className="w-8 shrink-0 text-center text-[11px] tabular-nums text-muted">{fmtDay(m.date)}</time>
                <div className="flex w-28 shrink-0 flex-col gap-2">
                  <TeamLine name={m.home.name} logo={m.home.logo} />
                  <TeamLine name={m.away.name} logo={m.away.logo} />
                </div>
                <div className="flex w-4 shrink-0 flex-col gap-2 text-center text-[13px] font-extrabold tabular-nums text-fg">
                  <span>{m.home.score ?? '-'}</span>
                  <span>{m.away.score ?? '-'}</span>
                </div>
                <span className="flex-1" aria-hidden />
                <span className="w-8 shrink-0 text-center text-xs tabular-nums text-muted">{m.minutes ?? ''}</span>
                <span className="w-7 shrink-0 text-center text-xs font-bold text-fg">
                  {m.goals && m.goals !== '0' ? (
                    <span title="أهداف">
                      ⚽<sup className="text-[9px]">{m.goals}</sup>
                    </span>
                  ) : null}
                </span>
                {m.rating ? (
                  <span
                    className="flex h-7 w-9 shrink-0 items-center justify-center text-xs font-extrabold text-white"
                    style={{ backgroundColor: m.ratingColor ?? 'var(--muted)' }}
                  >
                    {m.rating}
                  </span>
                ) : (
                  <span className="w-9 shrink-0" aria-hidden />
                )}
              </Link>
            ))}
          </div>
          {moreHref && (
            <Link
              href={moreHref}
              className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
            >
              عرض الكل
            </Link>
          )}
        </>
      ) : (
        <p className="p-6 text-center text-xs text-muted">لا تتوفّر مباريات حاليّاً.</p>
      )}
    </section>
  );
}

function TeamLine({ name, logo }: { name: string; logo: string | null }) {
  return (
    <span className="flex items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
        <img src={logo} alt="" loading="lazy" className="size-4 shrink-0 object-contain" />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-fg">{name}</span>
    </span>
  );
}

// «مسيرة اللاعب» — مسيرته بالإحصاء (athletes/career): قسم لكلّ فئة (نادٍ/منتخب)، وجدول بطولاتها بإحصاءاته فيها.
export function PlayerCareer({ sections }: { sections: PlayerCareerSection[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">مسيرة اللاعب</h2>
      </div>
      {sections.length > 0 ? (
        sections.map((s, si) => (
          <div key={si} className="border-b border-border last:border-b-0">
            {s.name && <div className="bg-surface-2 px-4 py-2 text-xs font-extrabold text-fg">{s.name}</div>}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted">
                    <th className="px-3 py-2 text-start font-medium">البطولة</th>
                    {s.columns.map((c) => (
                      <th key={c.num} className="px-2 py-2 text-center font-medium">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, ri) => (
                    <tr key={ri} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-bold text-fg">{r.title}</td>
                      {s.columns.map((c) => (
                        <td key={c.num} className="px-2 py-2 text-center tabular-nums text-muted">
                          {r.values[c.num] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <p className="p-6 text-center text-xs text-muted">لا تتوفّر بيانات مسيرة حاليّاً.</p>
      )}
    </section>
  );
}

// «الألقاب» — ألقاب اللاعب (athletes/trophies/stats): مجموعة لكلّ بطولة فاز بها، وصفوف (الفريق/الموسم/مشاركات/أهداف).
export function PlayerTrophies({ groups }: { groups: PlayerTrophy[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">الألقاب</h2>
      </div>
      {groups.length > 0 ? (
        <>
          {/* عرض الكؤوس (نمط 365): أيقونة كأس + اسم البطولة + عدد مرّات الفوز */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 px-4 py-5">
            {groups.map((g, gi) => (
              <div key={gi} className="flex w-24 flex-col items-center gap-1.5 text-center">
                <span className="text-3xl" aria-hidden>
                  🏆
                </span>
                <span className="text-[11px] font-bold leading-tight text-fg">
                  {g.competition} ({g.count})
                </span>
              </div>
            ))}
          </div>
          {/* جدول لكلّ بطولة: الفريق/الموسم + الأعمدة الديناميكيّة (مشاركات/أهداف/صناعة) */}
          {groups.map((g, gi) => (
            <div key={gi} className="border-t border-border">
              <div className="bg-surface-2 px-4 py-2 text-xs font-extrabold text-fg">{g.competition}</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-muted">
                      <th className="px-3 py-2 text-start font-medium">الفريق</th>
                      <th className="px-2 py-2 text-center font-medium">الموسم</th>
                      {g.columns.map((c) => (
                        <th key={c.num} className="px-2 py-2 text-center font-medium">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            {r.competitorLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
                              <img src={r.competitorLogo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
                            ) : null}
                            <span className="truncate font-bold text-fg">{r.competitor}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-muted">{r.season ?? '-'}</td>
                        {g.columns.map((c) => (
                          <td key={c.num} className="px-2 py-2 text-center tabular-nums text-muted">
                            {r.values[c.num] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : (
        <p className="p-6 text-center text-xs text-muted">لا تتوفّر بيانات ألقاب حاليّاً.</p>
      )}
    </section>
  );
}

// يوم/شهر (16/06) — startTime بإزاحة +03:00 (عمّان) فالـslice يعطي تاريخ عمّان مباشرةً، بترتيب يوم/شهر كـ365.
function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}` : '';
}
