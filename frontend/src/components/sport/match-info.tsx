import { Card, CardHeader } from '@/components/ui/card';
import type { MatchDetail } from '@/lib/sport/domain/entities';

// قسم «معلومات المباراة» (نمط 365 game-info) — بطولة/جولة + موعد + ملعب + حكم + حالة. يظهر لكلّ مباراة (يملأ صفحة
// المباريات المقبلة). صفوف ذات بيانات فقط — لا تلفيق.
export function MatchInfo({ d }: { d: MatchDetail }) {
  const rows: { label: string; value: string }[] = [];
  if (d.competition) rows.push({ label: 'البطولة', value: d.round ? `${d.competition} · ${d.round}` : d.competition });
  const when = formatWhen(d.startTime);
  if (when) rows.push({ label: 'الموعد', value: when });
  if (d.venue) rows.push({ label: 'الملعب', value: d.venue });
  if (d.referee) rows.push({ label: 'الحكم', value: d.referee });
  if (d.statusText) rows.push({ label: 'الحالة', value: d.statusText });
  if (!rows.length) return null;

  return (
    <Card as="section" dir="rtl">
      <CardHeader>
        <h2 className="text-sm font-extrabold text-fg">معلومات المباراة</h2>
      </CardHeader>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
            <dt className="shrink-0 text-xs text-muted">{r.label}</dt>
            <dd className="truncate text-end text-sm font-bold text-fg">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('ar', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Amman',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}
