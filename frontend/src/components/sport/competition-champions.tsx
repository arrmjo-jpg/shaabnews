import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import type { CompetitionChampion } from '@/lib/sport/domain/entities';

// تبويب «الأبطال» (نمط 365 entity-history-widget) — جدول مواسم، كلّ صفّ: شعار البطل + الإصدار «قطر 2022» + اسم البطل
// + سطر النتيجة الجاهز «فرنسا 4-2 (بعد ضربات الترجيح)»، ورابطٌ لمباراة النهائيّ (سهم). الأحدث أوّلاً. المصدر
// `competitions/history` (appTypeId=5). بلا تلفيق — صفوف بلا بطل مُستبعَدة، وسطر النتيجة/الرابط يظهران فقط عند توفّرهما.
export function CompetitionChampions({ rows, title }: { rows: CompetitionChampion[]; title?: string }) {
  if (!rows.length) {
    return <Card className="p-8 text-center text-sm text-muted">لا بيانات أبطال متاحة.</Card>;
  }
  return (
    <Card as="section" dir="rtl">
      <CardHeader>
        <h2 className="text-sm font-extrabold text-fg">{title ? `أبطال ${title}` : 'الأبطال'}</h2>
      </CardHeader>
      <ul>
        {rows.map((r, i) => (
          <li key={`${r.seasonNum}-${i}`} className="border-b border-border last:border-b-0">
            <Row r={r} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Row({ r }: { r: CompetitionChampion }) {
  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
        {r.winner.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
          <img src={r.winner.logo} alt="" loading="lazy" className="size-full object-contain" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        {r.title && <span className="block truncate text-[11px] font-bold text-muted">{r.title}</span>}
        <span className="block truncate text-sm font-extrabold text-fg">{r.winner.name || '—'}</span>
        {r.result && <span className="block truncate text-[11px] text-muted">{r.result}</span>}
      </span>
      {r.finalGameId && <ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden />}
    </>
  );
  return r.finalGameId ? (
    <Link href={`/sport/match/${r.finalGameId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  );
}
