'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, Volume2, X } from 'lucide-react';

import { getClientId } from '@/lib/client-id';

// طبقة قراءة مشتركة - "استمع للمقال" عبر Google Gemini TTS (الخادم يولد الصوت بالمفتاح الخادمي).
// يُرسل نص المحتوى من DOM (targetId) إلى BFF /api/tts، ويُشغل الناتج (WAV) بعنصر <audio>.
//
// التصميم: زر مدمج بسيط في حالة idle/loading/error (كما كان)، وعند بدء التشغيل الفعلي يتحول
// إلى شريط مشغل مصغر لاصق أسفل الشاشة (Sticky Mini Player) - شريط تقدم قابل للنقر للتنقل +
// الوقت الحالي/الإجمالي + تحكم بالسرعة + زر إغلاق. يبقى ظاهرا أثناء التمرير في الصفحة، ويختفي
// تلقائيا عند الإيقاف الكامل. نفس منطق التشغيل/الإيقاف/السرعة بالضبط - تصميم عرض فقط.
const RATES = [0.8, 1, 1.2, 1.5] as const;

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioReader({ targetId }: { targetId: string }) {
  const [state, setState] = useState<State>('idle');
  const [rate, setRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const ensureAudio = (): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.onended = () => setState('idle');
      audio.onerror = () => setState('error');
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onloadedmetadata = () => setDuration(audio.duration || 0);
      audio.ondurationchange = () => setDuration(audio.duration || 0);
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const play = async () => {
    const audio = ensureAudio();
    audio.playbackRate = rate;

    if (audio.src) {
      try {
        await audio.play();
        setState('playing');
      } catch {
        setState('error');
      }
      return;
    }

    const el = document.getElementById(targetId);
    const text = (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 5000);
    if (!text) return;

    setState('loading');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
        body: JSON.stringify({ text }),
      });
      const data: { success?: boolean; audio?: string | null } = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.audio) {
        setState('error');
        return;
      }
      audio.src = data.audio;
      audio.playbackRate = rate;
      await audio.play();
      setState('playing');
    } catch {
      setState('error');
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setState('paused');
  };
  const resume = async () => {
    try {
      await audioRef.current?.play();
      setState('playing');
    } catch {
      setState('error');
    }
  };
  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTime(0);
    setState('idle');
  };
  const cycleRate = () => {
    const idx = RATES.indexOf(rate as (typeof RATES)[number]);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  const seekTo = (clientX: number) => {
    const el = trackRef.current;
    const audio = audioRef.current;
    if (!el || !audio || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const isBarVisible = state === 'playing' || state === 'paused';
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      {state === 'idle' && (
        <button
          type="button"
          onClick={() => void play()}
          className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          <Volume2 className="size-4" aria-hidden /> استمع للمقال
        </button>
      )}

      {state === 'loading' && (
        <span
          className="inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-sm font-bold text-white"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> جارٍ التحضير…
        </span>
      )}

      {state === 'error' && (
        <button
          type="button"
          onClick={() => void play()}
          title="تعذر توليد الصوت، أعد المحاولة"
          className="inline-flex items-center gap-1.5 bg-danger/10 px-3 py-1.5 text-sm font-bold text-danger transition-colors hover:bg-danger/20"
        >
          <Volume2 className="size-4" aria-hidden /> أعد المحاولة
        </button>
      )}

      {isBarVisible && (
        <div className="fixed inset-x-0 bottom-0 z-[70] print:hidden audio-bar-rise" role="region" aria-label="مشغل استماع المقال">
          <div className="border-t border-border bg-surface/95 shadow-[0_-8px_28px_rgba(0,0,0,0.1)] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
            <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
              <button
                type="button"
                onClick={state === 'playing' ? pause : () => void resume()}
                aria-label={state === 'playing' ? 'إيقاف مؤقت' : 'متابعة'}
                className="flex size-10 shrink-0 items-center justify-center bg-primary text-white transition-transform hover:scale-105 active:scale-95"
                style={{ borderRadius: '9999px' }}
              >
                {state === 'playing' ? (
                  <Pause className="size-[18px]" aria-hidden />
                ) : (
                  <Play className="size-[18px] translate-x-[1px]" aria-hidden />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="mb-1.5 truncate text-xs font-bold text-fg sm:text-sm">استماع للمقال</p>
                <div
                  ref={trackRef}
                  dir="ltr"
                  role="slider"
                  aria-label="موضع التشغيل"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration)}
                  aria-valuenow={Math.round(currentTime)}
                  tabIndex={0}
                  onClick={(e) => seekTo(e.clientX)}
                  onKeyDown={(e) => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    if (e.key === 'ArrowRight') audio.currentTime = Math.min(duration, audio.currentTime + 5);
                    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
                  }}
                  className="group relative h-1.5 w-full cursor-pointer bg-surface-3"
                  style={{ borderRadius: '9999px' }}
                >
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${progressPct}%`, borderRadius: '9999px' }}
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-y-1/2 bg-primary opacity-0 shadow ring-2 ring-white transition-opacity group-hover:opacity-100"
                    style={{ insetInlineStart: `calc(${progressPct}% - 6px)`, borderRadius: '9999px' }}
                    aria-hidden
                  />
                </div>
              </div>

              <span dir="ltr" className="hidden shrink-0 tabular-nums text-xs text-muted sm:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button
                type="button"
                onClick={cycleRate}
                aria-label="سرعة القراءة"
                className="shrink-0 bg-surface-2 px-2.5 py-1 text-xs font-bold text-fg transition-colors hover:bg-surface-3"
              >
                {rate}×
              </button>

              <button
                type="button"
                onClick={stop}
                aria-label="إغلاق المشغل"
                className="flex size-8 shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                style={{ borderRadius: '9999px' }}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
