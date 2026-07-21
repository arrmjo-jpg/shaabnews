import Link from 'next/link';
import { StandingsTable } from '@/components/sport/standings-table';
import type { Standing } from '@/lib/sport/domain/entities';

// عرض الترتيب المتكيّف: بطولات المجموعات (كأس عالم — `groups.length > 1`) ⇒ جدول لكلّ مجموعة بعنوانها («المجموعة أ»)،
// والدوريات أحاديّة الجدول ⇒ جدول واحد مسطّح. يعيد استخدام `StandingsTable` كما هو (صفوف مُرشَّحة بـ`groupNum`).
export function StandingsView({ data, showLegend = false }: { data: Standing; showLegend?: boolean }) {
  const groups = data.groups.filter((g) => data.rows.some((r) => r.groupNum === g.num));

  if (groups.length <= 1) {
    return (
      <div dir="rtl" className="border border-border bg-white px-2 py-1">
        <StandingsTable data={data} showLegend={showLegend} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, i) => (
        <section key={g.num} dir="rtl" className="border border-border bg-white">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-sm font-extrabold text-fg">{g.name}</div>
          <div className="px-2 py-1">
            <StandingsTable
              data={{ ...data, rows: data.rows.filter((r) => r.groupNum === g.num) }}
              showLegend={showLegend && i === groups.length - 1}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

// معاينة الترتيب لتبويب التفاصيل (نمط 365 standings-preview) — ترويسة شعار+اسم البطولة، ثمّ **أوّل مجموعتين**
// لبطولات المجموعات (جدول لكلّ مجموعة) أو أوّل ٨ صفوف للدوريات أحاديّة الجدول، وتذييل «مجموعات {البطولة}» →
// تبويب الترتيب الكامل. يعيد استخدام `StandingsTable`. مطبَّق على كلّ البطولات (يتكيّف بعدد المجموعات).
export function StandingsPreview({
  data,
  meta,
}: {
  data: Standing;
  meta: { id: number; name: string; logo: string | null };
}) {
  const groups = data.groups.filter((g) => data.rows.some((r) => r.groupNum === g.num));
  const multi = groups.length > 1;

  return (
    <section dir="rtl" className="border border-border bg-white">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {meta.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- شعار بطولة 365 من CDN
          <img src={meta.logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
        )}
        <h2 className="truncate text-sm font-extrabold text-fg">{meta.name}</h2>
      </div>

      {multi ? (
        groups.slice(0, 2).map((g) => (
          <div key={g.num}>
            <div className="border-b border-border bg-surface-2 px-4 py-2 text-sm font-extrabold text-fg">{g.name}</div>
            <div className="px-2 py-1">
              <StandingsTable data={{ ...data, rows: data.rows.filter((r) => r.groupNum === g.num) }} />
            </div>
          </div>
        ))
      ) : (
        <div className="px-2 py-1">
          <StandingsTable data={data} limit={8} />
        </div>
      )}

      <Link
        href={`/sport/competition/${meta.id}?tab=standings`}
        className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
      >
        {multi ? `مجموعات ${meta.name}` : 'الترتيب الكامل'}
      </Link>
    </section>
  );
}
