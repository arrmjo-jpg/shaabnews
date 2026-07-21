'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LineupMember, TeamLineupSummary } from '@/lib/sport/domain/entities';

// تبويب «التشكيلة المتوقعة» (نسخة طبق‑الأصل من 365) — تبويبا فريقين (المضيف أوّلاً يميناً) + ملعب 365 رأسيّ لفريق
// واحد: صورة اللاعب الدائريّة + رقم القميص + شعار ناديه + الاسم، والحارس أسفل والمهاجم أعلى (عبر yardFormation).
// خطّة اللعب أسفل الملعب. كلّ لاعب رابط لملفّه. لا تلفيق: لاعب بلا صورة ⇒ دائرة فارغة، وفريق بلا تشكيلة ⇒ حالة صادقة.
const PITCH_SVG =
  'https://imagecache.365scores.com/image/upload/f_svg,c_limit,q_auto:eco,dpr_1/website/AssetsSVGNewBrand/Lineups_Pitch_RTL';

export function MatchLineup({
  home,
  away,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
  homeLogo,
  awayLogo,
}: {
  home: TeamLineupSummary | null;
  away: TeamLineupSummary | null;
  homeTeam: string;
  awayTeam: string;
  homeColor: string | null;
  awayColor: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  const [side, setSide] = useState<'home' | 'away'>(home ? 'home' : 'away');
  if (!home && !away) {
    return (
      <div className="border border-border bg-white p-8 text-center text-sm text-muted">التشكيلة غير متاحة لهذه المباراة.</div>
    );
  }
  const cur = side === 'home' ? home : away;

  return (
    <section dir="rtl" className="overflow-hidden border border-border bg-white">
      {/* تبويبا الفريقين (المضيف يمين، الافتراضيّ) */}
      <div className="flex border-b border-border">
        <TabBtn active={side === 'home'} label={homeTeam} logo={homeLogo} color={homeColor} onClick={() => setSide('home')} />
        <TabBtn active={side === 'away'} label={awayTeam} logo={awayLogo} color={awayColor} onClick={() => setSide('away')} />
      </div>

      {cur ? (
        <>
          <div className="relative w-full" style={{ aspectRatio: '728 / 547' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ملعب 365 (SVG) من CDN */}
            <img src={PITCH_SVG} alt="" className="absolute inset-0 size-full object-fill" />
            {cur.starters.map((p) => (
              <Marker key={p.id} p={p} />
            ))}
            {cur.formation && (
              <span
                dir="ltr"
                className="absolute bottom-1.5 start-2 bg-black/45 px-2 py-0.5 text-xs font-extrabold tracking-wider text-white"
              >
                {cur.formation.split('-').join(' - ')}
              </span>
            )}
          </div>
          {cur.bench.length > 0 && <Bench players={cur.bench} />}
        </>
      ) : (
        <div className="p-8 text-center text-sm text-muted">التشكيلة غير متاحة لهذا الفريق.</div>
      )}
    </section>
  );
}

function TabBtn({
  active,
  label,
  logo,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  logo: string | null;
  color: string | null;
  onClick: () => void;
}) {
  // النشط: لون الفريق فقط إن كان داكناً بما يكفي (lum ≤ 0.6) بنصّ أبيض؛ وإلّا (أبيض/فاتح كالسنغال) ⇒ أحمر الموقع
  // عبر صنف `bg-primary` المضمون (لا `var(--primary)` المضمّن الذي قد لا يُحَلّ فيظهر أبيض).
  const lum = luminance(color);
  const useTeamColor = active && !!color && lum != null && lum <= 0.6;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={
        'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-center text-sm font-extrabold transition-colors ' +
        (!active ? 'bg-surface-2 text-fg hover:bg-border' : useTeamColor ? 'text-white' : 'bg-primary text-white')
      }
      style={useTeamColor ? { backgroundColor: color ?? undefined } : undefined}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
        <img src={logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
      )}
      {label}
    </button>
  );
}

function luminance(hex: string | null): number | null {
  if (!hex) return null;
  const h = hex.replace('#', '').trim();
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (f.length !== 6) return null;
  const r = parseInt(f.slice(0, 2), 16);
  const g = parseInt(f.slice(2, 4), 16);
  const b = parseInt(f.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function Marker({ p }: { p: LineupMember }) {
  // fieldSide=العرض (x) · fieldLine=العمق (y، 0=حارس أسفل). هامش حتى لا تتجاوز العلامات الحواف.
  const left = 8 + (p.x ?? 50) * 0.84;
  const bottom = 6 + (p.y ?? 50) * 0.84;
  return (
    <Link
      href={`/sport/player/${p.id}`}
      className="absolute flex w-[19%] max-w-[76px] flex-col items-center"
      style={{ left: `${left}%`, bottom: `${bottom}%`, transform: 'translate(-50%, 50%)' }}
    >
      <span className="relative">
        <span className="avatar block size-11 overflow-hidden rounded-full border-2 border-white bg-surface-2 shadow sm:size-12">
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
            <img src={p.photo} alt="" loading="lazy" className="size-full object-cover" />
          ) : null}
        </span>
        <span className="avatar absolute -bottom-1 end-0 flex min-w-4 items-center justify-center rounded-full bg-black/85 px-1 text-[9px] font-bold leading-4 text-white">
          {p.jersey ?? ''}
        </span>
        {p.clubLogo && (
          <span className="avatar absolute -bottom-1 start-0 size-4 overflow-hidden rounded-full border border-white bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- شعار نادي 365 من CDN */}
            <img src={p.clubLogo} alt="" loading="lazy" className="size-full object-contain" />
          </span>
        )}
      </span>
      <span className="mt-1 max-w-full truncate bg-black/35 px-1 text-[10px] font-bold text-white">{p.name || '—'}</span>
    </Link>
  );
}

function Bench({ players }: { players: LineupMember[] }) {
  return (
    <div className="border-t border-border">
      <div className="bg-surface-2 px-4 py-2 text-[13px] font-extrabold text-fg">البدلاء</div>
      <ul className="divide-y divide-border">
        {players.map((p) => (
          <li key={p.id}>
            <Link href={`/sport/player/${p.id}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-2">
              <span className="w-6 shrink-0 text-center text-[13px] font-bold tabular-nums text-muted">{p.jersey ?? '—'}</span>
              <span className="avatar size-7 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                  <img src={p.photo} alt="" loading="lazy" className="size-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p.name || '—'}</span>
              {p.position && <span className="shrink-0 text-[11px] text-muted">{p.position}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
