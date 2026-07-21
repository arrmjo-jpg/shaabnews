import { Trophy } from 'lucide-react';
import Link from 'next/link';
import type { CompetitionBracketMatch, CompetitionBracketParticipant, CompetitionBracketStage } from '@/lib/sport/domain/entities';

// خروج المغلوب — رسم شجرة الأدوار (لوحة داكنة نمط 365): عمود لكلّ دور، يمين→يسار (RTL) حتى النهائي،
// مع خطوط ربط (موصِّلات) بين الأدوار. كلّ مواجهة = مشاركان + موعد. المشاركون بصيغة التأهّل («1 ه»/«الفائز
// في المباراة 74») حتى تتحدّد الفرق فتظهر الأسماء/الشعارات تلقائيّاً. رابط لصفحة المباراة عند توفّر gameId.
export function CompetitionBrackets({
  stages,
  title,
  logo,
}: {
  stages: CompetitionBracketStage[];
  title?: string;
  logo?: string | null;
}) {
  if (!stages.length) {
    return (
      <div className="border border-border bg-white p-8 text-center text-sm text-muted">
        لا تتوفّر بيانات خروج المغلوب لهذه البطولة.
      </div>
    );
  }

  const lastIndex = stages.length - 1;

  return (
    <div dir="rtl" className="overflow-hidden border border-border bg-[#0e151b] text-white">
      <div className="flex items-center justify-center gap-2 border-b border-white/10 px-4 py-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
          <img src={logo} alt="" className="size-6 object-contain" />
        )}
        <h2 className="text-sm font-extrabold">{title ? `${title} — خروج المغلوب` : 'خروج المغلوب'}</h2>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-h-[520px] gap-7">
          {stages.map((stage, si) => {
            const hasOutgoing = si < lastIndex; // موصِّل خارج نحو الدور التالي (يسار)
            const hasIncoming = si > 0; // موصِّل داخل من الدور السابق (يمين)
            const isFinal = si === lastIndex;
            return (
              <div key={stage.name} className="flex w-[210px] shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-center gap-1.5 border-b border-white/15 pb-2 text-center text-xs font-extrabold text-white/85">
                  {isFinal && <Trophy className="size-3.5 text-amber-400" aria-hidden />}
                  {stage.name}
                </div>
                <div className="flex flex-1 flex-col">
                  {stage.matches.map((m, mi) => (
                    <div
                      key={`${stage.name}-${mi}`}
                      className={
                        'relative flex flex-1 items-center ' +
                        (hasOutgoing
                          ? "after:absolute after:left-[-14px] after:top-1/2 after:h-px after:w-[14px] after:bg-white/20 [&:nth-child(odd)]:before:absolute [&:nth-child(odd)]:before:left-[-14px] [&:nth-child(odd)]:before:top-1/2 [&:nth-child(odd)]:before:h-full [&:nth-child(odd)]:before:w-px [&:nth-child(odd)]:before:bg-white/20"
                          : '')
                      }
                    >
                      <div
                        className={
                          'w-full ' +
                          (hasIncoming
                            ? "relative before:absolute before:right-[-14px] before:top-1/2 before:h-px before:w-[14px] before:bg-white/20"
                            : '')
                        }
                      >
                        <MatchCell m={m} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchCell({ m }: { m: CompetitionBracketMatch }) {
  const body = (
    <div className="border border-white/10 bg-white/[0.04]">
      {m.date && <div className="px-2.5 pt-1.5 text-[10px] font-bold text-white/45">{formatWhen(m.date)}</div>}
      <ParticipantRow p={m.home} />
      <div className="mx-2.5 h-px bg-white/10" />
      <ParticipantRow p={m.away} />
    </div>
  );
  return m.gameId ? (
    <Link href={`/sport/match/${m.gameId}`} className="block transition-colors hover:bg-white/[0.07]">
      {body}
    </Link>
  ) : (
    body
  );
}

function ParticipantRow({ p }: { p: CompetitionBracketParticipant | null }) {
  if (!p) return <div className="px-2.5 py-2 text-xs text-white/40">—</div>;
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      {p.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- شعار الفريق من CDN 365
        <img src={p.logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
      ) : (
        <span className="avatar size-5 shrink-0 rounded-full bg-white/10" aria-hidden />
      )}
      <span className={'flex-1 truncate text-xs ' + (p.isQualified ? 'font-bold text-white' : 'text-white/70')}>{p.name}</span>
    </div>
  );
}

function formatWhen(iso: string): string {
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
