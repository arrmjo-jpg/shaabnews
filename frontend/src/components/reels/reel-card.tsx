'use client';

import Link from 'next/link';
import { useRef } from 'react';

import type { ReelItem } from '@/lib/reels';

// بطاقة ريل مفردة 9:16 (مُستخرَجة من كروسل الهوم — نفس الشكل: معاينة عند المرور + أيقونة تشغيل +
// مدّة + عنوان). **مصدر واحد** يُعاد استخدامه: الكاروسيل (يمرّر `onOpen` ⇒ زرّ يفتح الموديل)
// وصفحات نشاط الحساب (بلا `onOpen` ⇒ رابط لصفحة الريل العميقة). لا بطاقة جديدة، لا تكرار.
export function ReelCard({
  reel,
  logo = null,
  onOpen,
  className = 'w-[170px] shrink-0 sm:w-[200px]',
  flat = false,
}: {
  reel: ReelItem;
  logo?: string | null;
  onOpen?: () => void;
  // العرض افتراضيّاً ثابت (شريط الكاروسيل)؛ تمرير `w-full` يملأ خليّة الشبكة (نشاط الحساب).
  className?: string;
  // بلا حواف مدوّرة + ظل ناعم خفيف (كاروسيل الريلز في الرئيسية)، بدل الحواف الدائرية الافتراضية.
  flat?: boolean;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const duration = formatDuration(reel.durationSeconds);

  const onEnter = () => {
    vidRef.current?.play().catch(() => {});
  };
  const onLeave = () => {
    const v = vidRef.current;
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* noop */
      }
    }
  };

  const wrapperClass = `group relative block aspect-[9/16] overflow-hidden bg-surface-2 text-start ${flat ? 'shadow-sm' : ''} ${className}`;
  const style = flat ? undefined : ({ borderRadius: '12px' } as const);

  const inner = (
    <>
      {reel.mp4 || reel.poster ? (
        <video
          ref={vidRef}
          src={reel.mp4 ?? undefined}
          poster={reel.poster ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 size-full bg-surface-3" aria-hidden />
      )}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20"
        aria-hidden
      />

      {logo && (
        <span className="pointer-events-none absolute top-2 z-10" style={{ insetInlineStart: '0.5rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- شعار العلامة */}
          <img src={logo} alt="" className="h-5 w-auto object-contain opacity-90 drop-shadow" />
        </span>
      )}

      <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
        <span
          className="flex size-12 items-center justify-center bg-black/40 text-white backdrop-blur-sm"
          style={{ borderRadius: '9999px' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>

      {duration && (
        <span
          className="absolute top-2 z-10 bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white"
          style={{ insetInlineEnd: '0.5rem', borderRadius: '6px' }}
        >
          {duration}
        </span>
      )}

      <h3 className="absolute inset-x-0 bottom-0 z-10 line-clamp-2 p-3 text-sm font-bold leading-snug text-white underline-offset-2 drop-shadow group-hover:underline group-focus-visible:underline">
        {reel.title}
      </h3>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        aria-label={reel.title}
        className={wrapperClass}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={reel.href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      aria-label={reel.title}
      className={wrapperClass}
      style={style}
    >
      {inner}
    </Link>
  );
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
