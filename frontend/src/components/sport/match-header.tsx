import { MapPin } from 'lucide-react';
import { FollowButton } from '@/components/sport/follow-button';
import type { MatchDetail, MatchSideSummary } from '@/lib/sport/domain/entities';

// رأس المباراة: خلفيّة متدرّجة بألوان الفريقين (داكنة) + المجموعة/الجولة + شعاران + نتيجة/موعد/عدّاد
// + ملعب/حكم. سياق البطولة (شعار/اسم/تبويبات) في CompetitionHeader أعلى الصفحة — لا يُكرَّر هنا. RTL.

// لون فريق صالح (#RRGGBB) + شفافيّة للتدرّج؛ غير ذلك ⇒ null (لا تدرّج لذلك الجانب).
function tint(c: string | null): string | null {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? `${c}66` : null;
}

export function MatchHeader({ d }: { d: MatchDetail }) {
  const isLive = d.kind === 'live';
  const hasScore = d.home.score !== null && d.away.score !== null;

  // RTL: المضيف يمين (100%)، الضيف يسار (0%) — تدرّجان فوق قاعدة داكنة.
  const homeT = tint(d.home.color);
  const awayT = tint(d.away.color);
  const layers = [
    homeT ? `radial-gradient(115% 75% at 100% 50%, ${homeT} 0%, transparent 68%)` : null,
    awayT ? `radial-gradient(115% 75% at 0% 50%, ${awayT} 0%, transparent 68%)` : null,
  ].filter(Boolean) as string[];

  const stage = [d.group, d.round].filter(Boolean).join(' · ');

  return (
    <section
      dir="rtl"
      className="overflow-hidden border border-border text-white"
      style={{ backgroundColor: '#141b1f', backgroundImage: layers.length ? layers.join(', ') : undefined }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4 py-2">
        <span className="truncate text-xs font-bold text-white/80">{stage}</span>
        <FollowButton type="match" id={d.id} dark compact />
      </div>

      <div className="flex items-stretch justify-between gap-3 px-4 py-8 sm:px-10">
        <HeaderTeam side={d.home} />
        <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-2 text-center">
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-extrabold text-primary">
              <span className="avatar size-1.5 rounded-full bg-primary" aria-hidden />
              {d.minute ?? d.statusText ?? 'مباشر'}
            </span>
          )}
          {hasScore ? (
            <span className="flex items-center gap-3 text-4xl font-extrabold tabular-nums text-white sm:text-5xl">
              <span>{d.home.score}</span>
              <span className="text-white/40">-</span>
              <span>{d.away.score}</span>
            </span>
          ) : d.startTime ? (
            <span className="text-lg font-extrabold text-white sm:text-xl">{formatKickoff(d.startTime)}</span>
          ) : (
            <span className="text-3xl font-extrabold text-white/50">VS</span>
          )}
          {!isLive && d.statusText && <span className="text-[11px] font-bold text-white/60">{d.statusText}</span>}
        </div>
        <HeaderTeam side={d.away} />
      </div>

      {(d.venue || d.referee) && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/70">
          {d.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {d.venue}
            </span>
          )}
          {d.referee && <span>الحكم: {d.referee}</span>}
        </div>
      )}
    </section>
  );
}

function HeaderTeam({ side }: { side: MatchSideSummary }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
      {side.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار 365 من CDN
        <img
          src={side.logo}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:size-20"
        />
      ) : (
        <span
          className="avatar flex size-16 items-center justify-center rounded-full text-2xl font-extrabold text-white sm:size-20"
          style={{ backgroundColor: side.color ?? '#9aa0a6' }}
          aria-hidden
        >
          {(side.name || '?').slice(0, 1)}
        </span>
      )}
      <span className="line-clamp-2 text-sm font-bold text-white sm:text-base">{side.name || '—'}</span>
    </div>
  );
}

function formatKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Amman',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
