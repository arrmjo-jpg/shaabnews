'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ShotChart, ShotChartEntry } from '@/lib/sport/domain/entities';

// «خريطة التسديد» (نسخة طبق‑الأصل من 365 game-shot-chart) — لوحة داكنة بعمودين: يسار منتقٍ (لاعب + أسهم +
// مرمى يُظهر موضع الكرة + بطاقات الوضعية/طريقة التسديد/xG/xGOT) ويمين الملعب بكلّ التسديدات (نقاط بيضاء بحدّ
// بلون الفريق، الأهداف بكرة، المختارة مُبرَزة بهالة). الإحداثيات مُشتقّة بمطابقة الأهداف ببكسلات 365 (عامل 0.959).
// كلّ البيانات حقيقيّة من `chartEvents`، صفر مراهنات. النقر على نقطة (أو سهم) يختار التسديدة.

const SCALE = 0.959; // side/line (0..100) → نسبة الموضع على الملعب (مُعايَر على هدفَي مرجع 365)
const GOAL_FRAME =
  'https://imagecache.365scores.com/image/upload/f_png,c_limit,q_auto:eco,dpr_2/v18/Website/AssetsSVGNewBrand/Goalmounth_dark';

export function MatchShotMap({ data }: { data: ShotChart }) {
  const goalIdx = data.shots.findIndex((s) => s.isGoal);
  const [idx, setIdx] = useState(goalIdx >= 0 ? goalIdx : 0);
  const [playing, setPlaying] = useState(true); // تشغيل تلقائيّ كـ365 (يتنقّل بين التسديدات وحده)
  const [hover, setHover] = useState(false); // يتوقّف عند المرور بالماوس لتأمّل تسديدة
  const sel = data.shots[idx];
  const colorOf = (s: ShotChartEntry) => (s.isHome ? data.home.color : data.away.color);

  // الحلقة التلقائيّة: تتقدّم تسديدةً كلّ ~1.8ث ما لم يوقفها المستخدم أو يمرّ بالماوس.
  useEffect(() => {
    if (!playing || hover || data.shots.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % data.shots.length), 1800);
    return () => clearInterval(t);
  }, [playing, hover, data.shots.length]);

  const select = (i: number) => {
    setPlaying(false); // أيّ اختيار يدويّ يوقف التشغيل التلقائيّ
    setIdx(i);
  };
  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => (i + d + data.shots.length) % data.shots.length);
  };

  return (
    <section
      dir="rtl"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="overflow-hidden border border-border bg-[#0f1a22] text-white"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h2 className="text-sm font-extrabold">خريطة التسديد</h2>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'إيقاف العرض التلقائيّ' : 'تشغيل العرض التلقائيّ'}
          className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-white/20"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? 'إيقاف' : 'تشغيل'}
        </button>
      </div>

      <div className="grid items-center gap-4 p-4 lg:grid-cols-2">
        {/* يسار: المنتقي + لوحة المرمى */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            {/* اللاعب (يمين في RTL) */}
            <div className="flex min-w-0 items-center gap-2">
              {sel.player.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                <img src={sel.player.photo} alt="" loading="lazy" className="size-9 shrink-0 bg-white/10 object-cover" style={{ borderRadius: '50%' }} />
              )}
              <div className="min-w-0">
                {sel.player.id ? (
                  <Link href={`/sport/player/${sel.player.id}`} className="block truncate text-[13px] font-bold hover:underline">
                    {sel.player.name || '—'}
                  </Link>
                ) : (
                  <span className="block truncate text-[13px] font-bold">{sel.player.name || '—'}</span>
                )}
                {sel.outcomeName && (
                  <span className={'text-[11px] ' + (sel.isGoal ? 'font-bold text-emerald-400' : 'text-white/60')}>{sel.outcomeName}</span>
                )}
              </div>
            </div>
            {/* الأسهم + الدقيقة (يسار) */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="التسديدة السابقة"
                className="flex size-7 items-center justify-center bg-white/10 transition-colors hover:bg-white/20"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="min-w-9 text-center text-sm font-bold tabular-nums">{sel.time || ''}</span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="التسديدة التالية"
                className="flex size-7 items-center justify-center bg-white/10 transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
          </div>

          {/* لوحة المرمى: موضع الكرة من outcome (y أفقيّ، z ارتفاع) */}
          <div className="flex items-center justify-center bg-[#0a1218] py-5">
            <div className="relative w-[210px] max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- إطار المرمى من 365 CDN */}
              <img src={GOAL_FRAME} alt="" className="w-full select-none" />
              {sel.goalY != null && sel.goalZ != null && (
                <span
                  className="absolute block size-3.5 transition-all duration-500 ease-out"
                  style={{
                    left: `${100 - sel.goalY}%`,
                    bottom: `${sel.goalZ}%`,
                    transform: 'translate(-50%, 50%)',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: `2px solid ${colorOf(sel)}`,
                  }}
                >
                  <Ball />
                </span>
              )}
            </div>
          </div>
          {sel.goalDescription && <p className="text-center text-[11px] text-white/50">{sel.goalDescription}</p>}

          {/* البطاقات */}
          <div className="grid grid-cols-4 border-t border-white/10 pt-3 text-center">
            <Detail main={sel.situation} sub="الوضعية" border={false} />
            <Detail main={sel.bodyPart} sub="طريقة التسديد" border />
            <Detail main={sel.xg} sub="xG" border />
            <Detail main={sel.xgot} sub="xGOT" border />
          </div>
        </div>

        {/* يمين: الملعب بكلّ التسديدات */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '352 / 222' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- صورة الملعب من 365 CDN */}
          <img src={data.courtImage} alt="" className="absolute inset-0 size-full select-none object-cover" />
          {data.shots.map((s, i) => {
            const c = colorOf(s);
            const isSel = i === idx;
            const pos = s.isHome
              ? { left: `${s.side * SCALE}%`, bottom: `${s.line * SCALE}%`, transform: 'translate(-50%, 50%)' }
              : { right: `${s.side * SCALE}%`, top: `${s.line * SCALE}%`, transform: 'translate(50%, -50%)' };
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => select(i)}
                aria-label={`${s.player.name || 'تسديدة'} ${s.time || ''} — ${s.outcomeName || ''}`}
                className="absolute flex items-center justify-center transition-all duration-300 ease-out"
                style={{
                  ...pos,
                  width: isSel ? 15 : 11,
                  height: isSel ? 15 : 11,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  border: `${isSel ? 2 : 1.5}px solid ${c}`,
                  opacity: isSel ? 1 : 0.85,
                  zIndex: isSel ? 6 : s.isGoal ? 3 : 1,
                  boxShadow: isSel ? `0 0 0 3px ${c}80` : undefined,
                }}
              >
                {s.isGoal && <Ball />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Detail({ main, sub, border }: { main: string | null; sub: string; border: boolean }) {
  return (
    <div className={'px-1 ' + (border ? 'border-s border-white/10' : '')}>
      <div className="truncate text-[13px] font-bold tabular-nums">{main || '—'}</div>
      <div className="mt-0.5 text-[10px] text-white/50">{sub}</div>
    </div>
  );
}

// كرة قدم مصغّرة (للأهداف وموضع المرمى) — أيقونة 365 نفسها.
function Ball() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="#151E22" aria-hidden>
      <path d="M19.07 4.94a10 10 0 1 0 .01 14.14 10 10 0 0 0-.01-14.14ZM18.25 17h-2.25l-1.26 2.51a8 8 0 0 1-5.49-.01L7.99 17H5.76a8 8 0 0 1-1.62-3.52L6 11.01 4.78 8.57a8 8 0 0 1 1.56-2.22 8 8 0 0 1 3.22-1.97L12 6l2.44-1.62a8 8 0 0 1 3.22 1.97 8 8 0 0 1 1.56 2.22L18 11.01l1.86 2.47A8 8 0 0 1 18.25 17Z" />
      <path d="M8.5 11 10 15h4l1.5-4L12 8.5 8.5 11Z" />
    </svg>
  );
}
