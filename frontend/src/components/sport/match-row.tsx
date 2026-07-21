import Link from 'next/link';
import { FollowButton } from '@/components/sport/follow-button';
import type { MatchListItem, MatchSideSummary } from '@/lib/sport/domain/entities';

// بطاقة مباراة — وفق مواصفة game-card 365 (بكودنا، هويّة الموقع). صفّ مضغوط، حدّ سفليّ، Hover خفيف، خلفيّة بيضاء.
// **الصفّ كلّه رابط** لصفحة التفاصيل `/sport/match/{id}` (مثل الهيرو).
// RTL: اسم المضيف (يملأ، محاذاة خارجيّة) + شعار(32px) داخليّ | المركز نتيجة/وقت (16px/500) | شعار الضيف داخليّ + اسمه (يملأ، خارجيّة).
export function MatchRow({ match }: { match: MatchListItem }) {
  const isLive = match.kind === 'live';
  const hasScore = match.home.score !== null && match.away.score !== null;

  return (
    <div
      dir="rtl"
      className="flex items-center border-b border-border transition-colors last:border-b-0 hover:bg-surface-2"
    >
      <Link href={`/sport/match/${match.id}`} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-right text-[13px] font-medium text-fg">{match.home.name || '—'}</span>
          <TeamLogo side={match.home} />
        </div>

        <div className="flex w-14 shrink-0 flex-col items-center justify-center leading-none">
          {isLive && (
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold text-primary">
              <span className="size-1 rounded-full bg-primary" aria-hidden />
              {match.minute ?? 'مباشر'}
            </span>
          )}
          {hasScore ? (
            <span className="flex items-center gap-1 text-base font-medium tabular-nums text-fg">
              <span>{match.home.score}</span>
              <span className="text-muted">-</span>
              <span>{match.away.score}</span>
            </span>
          ) : (
            <span className="text-base font-medium text-fg">{formatTime(match.startTime)}</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogo side={match.away} />
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-fg">{match.away.name || '—'}</span>
        </div>
      </Link>

      <FollowButton type="match" id={match.id} bare className="me-1" />
    </div>
  );
}

function TeamLogo({ side }: { side: MatchSideSummary }) {
  if (side.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- شعار 365 من CDN
    return <img src={side.logo} alt="" loading="lazy" decoding="async" className="size-8 shrink-0 object-contain" />;
  }
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center text-[10px] font-extrabold text-white"
      style={{ backgroundColor: side.color ?? '#9aa0a6' }}
      aria-hidden
    >
      {(side.name || '?').slice(0, 1)}
    </span>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
}
