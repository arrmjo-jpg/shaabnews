import { BarChart3, LayoutGrid, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { CompetitionProfile, MatchDetail } from '@/lib/sport/domain/entities';

// ودجت «أبرز المباريات» (نمط 365 featured-games) — بطاقة المباراة المميّزة للبطولة الحاليّة: ترويسة (شعار+اسم
// البطولة+المجموعة، رابط للبطولة) + شارة موعد (اليوم/غدًا/تاريخ/مباشر)، صفّ الفريقين بخلفيّة ألوانهما الحقيقيّة
// (مع تباين نصّ مقروء محسوب) + VS/النتيجة، وصف (تاريخ|وقت|ملعب)، و٤ أزرار تعمل: صفحة المباراة·تشكيلة الفريقين·
// الإحصائيات → صفحة المباراة، المجموعات → ترتيب البطولة. كلّ البيانات من تفاصيل المباراة الفعليّة — بلا تلفيق.
export function FeaturedMatchWidget({ detail, meta }: { detail: MatchDetail; meta: CompetitionProfile }) {
  const matchHref = `/sport/match/${detail.id}`;
  const home = readable(detail.home.color);
  const away = readable(detail.away.color);
  const showScore = (detail.kind === 'finished' || detail.kind === 'live') && detail.home.score !== null && detail.away.score !== null;
  const title = [meta.name, detail.group].filter(Boolean).join(' - ');

  const buttons = [
    { label: 'صفحة المباراة', href: matchHref, Icon: LayoutGrid },
    { label: 'تشكيلة الفريقين', href: matchHref, Icon: Users },
    { label: 'الإحصائيات', href: matchHref, Icon: BarChart3 },
    { label: 'المجموعات', href: `/sport/competition/${meta.id}?tab=standings`, Icon: Trophy },
  ];

  return (
    <Card as="section" dir="rtl">
      <div className="bg-primary px-4 py-2 text-center text-sm font-extrabold text-white">أبرز المباريات</div>

      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href={`/sport/competition/${meta.id}`}
            className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
          >
            {meta.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- شعار بطولة 365 من CDN
              <img src={meta.logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
            ) : null}
            <span className="truncate text-xs font-bold text-muted">{title}</span>
          </Link>
          {dayBadge(detail) && (
            <span className="shrink-0 bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-fg">{dayBadge(detail)}</span>
          )}
        </div>

        <Link
          href={matchHref}
          className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-px overflow-hidden border border-border bg-border"
        >
          <Team side={detail.home} colors={home} />
          <div className="flex min-w-14 flex-col items-center justify-center bg-surface px-2">
            {showScore ? (
              <span dir="ltr" className="text-xl font-extrabold tabular-nums text-fg">
                {detail.home.score} - {detail.away.score}
              </span>
            ) : (
              <span className="text-sm font-extrabold text-muted">VS</span>
            )}
            {detail.kind === 'live' && detail.minute && (
              <span className="mt-0.5 text-[10px] font-bold text-primary">{detail.minute}</span>
            )}
          </div>
          <Team side={detail.away} colors={away} />
        </Link>

        <p className="mt-3 text-center text-xs text-muted">{description(detail)}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {buttons.map((b) => (
            <Link
              key={b.label}
              href={b.href}
              className="sport-card flex flex-col items-center gap-1.5 border border-border px-2 py-3 text-center text-[11px] font-bold text-fg transition-colors hover:border-primary hover:text-primary"
            >
              <b.Icon className="size-5 text-primary" />
              {b.label}
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Team({ side, colors }: { side: MatchDetail['home']; colors: { bg: string; fg: string } }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-3 py-4"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
        <img src={side.logo} alt="" loading="lazy" className="size-12 object-contain" />
      ) : null}
      <span className="line-clamp-2 text-center text-sm font-extrabold">{side.name}</span>
    </div>
  );
}

// تباين نصّ مقروء فوق لون الفريق (luminance) — أبيض فوق الداكن، داكن فوق الفاتح. بلا لون ⇒ خلفيّة الثيم.
function readable(hex: string | null): { bg: string; fg: string } {
  const fallback = { bg: 'var(--surface-2)', fg: 'var(--fg)' };
  if (!hex) return fallback;
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return fallback;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { bg: `#${full}`, fg: lum > 0.6 ? '#15202b' : '#ffffff' };
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', ...opts }).format(new Date(iso));
  } catch {
    return '';
  }
}

function ymdAmman(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function dayBadge(detail: MatchDetail): string {
  if (detail.kind === 'live') return detail.minute ?? 'مباشر';
  if (detail.kind === 'finished') return 'انتهت';
  if (!detail.startTime) return '';
  const target = ymdAmman(new Date(detail.startTime));
  if (target === ymdAmman(new Date())) return 'اليوم';
  if (target === ymdAmman(new Date(Date.now() + 86_400_000))) return 'غدًا';
  return fmt(detail.startTime, { day: '2-digit', month: '2-digit' });
}

function description(detail: MatchDetail): string {
  if (!detail.startTime) return detail.venue ?? '';
  const date = fmt(detail.startTime, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = fmt(detail.startTime, { hour: '2-digit', minute: '2-digit' });
  return [date, time, detail.venue].filter(Boolean).join(' | ');
}
