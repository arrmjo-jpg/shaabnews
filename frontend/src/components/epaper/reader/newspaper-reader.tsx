'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ReaderCanvasPage } from './reader-canvas-page';
import { ReaderMobileBar } from './reader-mobile-bar';
import { ReaderThumbnails } from './reader-thumbnails';
import { ReaderToolbar } from './reader-toolbar';
import { usePdfDocument } from './use-pdf-document';
import { useReadingMemory } from './use-reading-memory';

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;
const WHEEL_COOLDOWN = 450; // ms بين انتقالات العجلة

type FitMode = 'width' | 'page' | 'custom';
type Focal = { x: number; y: number } | undefined;

interface NewspaperReaderProps {
  src: string; // وكيل الـ PDF الأصليّ نفس‑الأصل: /api/epaper/{idslug}
  storageId: string;
  title: string;
  backHref: string;
  downloadUrl: string | null;
}

// تجميع الصفحات أزواجاً متقابلة كالجرائد الورقيّة: الغلاف (1) وحده، ثمّ [2,3] [4,5] … وعلى الجوّال
// صفحة واحدة لكلّ شاشة. في RTL: العنصر الأوّل من الزوج يقع يميناً (الصفحة الأقدم).
function buildSpreads(numPages: number, single: boolean): number[][] {
  if (numPages <= 0) return [];
  if (single) return Array.from({ length: numPages }, (_, i) => [i + 1]);
  const spreads: number[][] = [[1]];
  for (let p = 2; p <= numPages; p += 2) spreads.push(p + 1 <= numPages ? [p, p + 1] : [p]);
  return spreads;
}

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function NewspaperReader({ src, storageId, title, backHref, downloadUrl }: NewspaperReaderProps) {
  const { doc, numPages, baseWidth, baseHeight, status } = usePdfDocument(src);
  const { read: readMemory, save: saveMemory } = useReadingMemory(storageId);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [customScale, setCustomScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const isMobile = useMediaQuery('(max-width: 640px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const restored = useRef(false);
  const pendingZoom = useRef<{ ratio: number; fx: number; fy: number } | null>(null);
  const wheelLock = useRef(0);

  const spreads = useMemo(() => buildSpreads(numPages, isMobile), [numPages, isMobile]);
  const cols = isMobile ? 1 : 2; // أقصى صفحات لكلّ شاشة (لتثبيت حجم الصفحة عبر الأزواج)
  const clampedIndex = Math.min(index, Math.max(0, spreads.length - 1));
  const spread = spreads[clampedIndex] ?? [];
  const firstPage = spread[0] ?? 1;

  const firstPageRef = useRef(1);
  firstPageRef.current = firstPage;

  const rotated = rotation % 180 !== 0;
  const dispBaseW = rotated ? baseHeight : baseWidth;
  const dispBaseH = rotated ? baseWidth : baseHeight;

  const fitWidthScale = dispBaseW > 0 && avail.w > 0 ? avail.w / (cols * dispBaseW) : 1;
  const fitPageScale =
    dispBaseW > 0 && dispBaseH > 0 && avail.w > 0 && avail.h > 0
      ? Math.min(avail.w / (cols * dispBaseW), avail.h / dispBaseH)
      : 1;
  const scale = fitMode === 'width' ? fitWidthScale : fitMode === 'page' ? fitPageScale : customScale;
  const pageW = Math.max(1, dispBaseW * scale);
  const pageH = Math.max(1, dispBaseH * scale);
  const zoomed = scale > fitWidthScale * 1.02;

  // قياس المساحة المتاحة.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [status]);

  // إبقاء الصفحة الحاليّة عند تبدّل التخطيط (جوّال↔مكتب) — أعِد حساب فهرس الزوج لها.
  useEffect(() => {
    const p = firstPageRef.current;
    const i = spreads.findIndex((s) => s.includes(p));
    if (i >= 0) {
      setDir(null);
      setIndex(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreads.length]);

  const goToSpread = useCallback(
    (i: number, direction: 'next' | 'prev') => {
      setIndex((cur) => {
        const next = Math.min(Math.max(i, 0), spreads.length - 1);
        if (next !== cur) setDir(direction);
        return next;
      });
    },
    [spreads.length],
  );

  const goToPage = useCallback(
    (p: number) => {
      const i = spreads.findIndex((s) => s.includes(Math.min(Math.max(p, 1), numPages)));
      if (i >= 0) goToSpread(i, i >= clampedIndex ? 'next' : 'prev');
    },
    [spreads, numPages, goToSpread, clampedIndex],
  );

  const next = useCallback(() => goToSpread(clampedIndex + 1, 'next'), [goToSpread, clampedIndex]);
  const prev = useCallback(() => goToSpread(clampedIndex - 1, 'prev'), [goToSpread, clampedIndex]);

  // تكبير متمركز حول نقطة (عند التكبير يظهر pan عبر overflow).
  const applyZoom = useCallback(
    (nextScale: number, focal?: Focal) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fx = (focal?.x ?? rect.left + rect.width / 2) - rect.left;
      const fy = (focal?.y ?? rect.top + rect.height / 2) - rect.top;
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      if (clamped === scale) return;
      pendingZoom.current = { ratio: clamped / scale, fx, fy };
      setFitMode('custom');
      setCustomScale(clamped);
    },
    [scale],
  );

  useLayoutEffect(() => {
    const el = stageRef.current;
    const p = pendingZoom.current;
    if (!el || !p) return;
    pendingZoom.current = null;
    el.scrollLeft = Math.max(0, (el.scrollLeft + p.fx) * p.ratio - p.fx);
    el.scrollTop = Math.max(0, (el.scrollTop + p.fy) * p.ratio - p.fy);
  }, [scale, pageW, pageH]);

  // تدفئة مخبأ الصفحات المجاورة (تقليب فوريّ) دون رسمها.
  useEffect(() => {
    if (!doc) return;
    const around = [spreads[clampedIndex - 1], spreads[clampedIndex + 1]].filter(Boolean).flat();
    around.forEach((p) => void doc.getPage(p).catch(() => {}));
  }, [doc, spreads, clampedIndex]);

  // استئناف القراءة.
  useEffect(() => {
    if (status !== 'ready' || restored.current) return;
    restored.current = true;
    const m = readMemory();
    if (!m) return;
    setRotation(m.rotation);
    setFitMode(m.fitMode);
    if (m.fitMode === 'custom') setCustomScale(m.scale);
    const i = buildSpreads(numPages, isMobile).findIndex((s) => s.includes(m.page));
    if (i >= 0) {
      setDir(null);
      setIndex(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== 'ready') return;
    saveMemory({ page: firstPage, scale, rotation, fitMode });
  }, [status, firstPage, scale, rotation, fitMode, saveMemory]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true);
      return;
    }
    let timer = 0;
    const show = () => {
      setChromeVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChromeVisible(false), 2500);
    };
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', show);
      window.removeEventListener('touchstart', show);
    };
  }, [isFullscreen]);

  const print = useCallback(() => window.open(src, '_blank', 'noopener'), [src]);

  // أوامر حيّة عبر ref.
  const cmd = useRef({ scale, avail, zoomed, next, prev, goToPage, applyZoom, toggleFullscreen });
  cmd.current = { scale, avail, zoomed, next, prev, goToPage, applyZoom, toggleFullscreen };

  // لوحة المفاتيح.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const c = cmd.current;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          c.applyZoom(c.scale * 1.2);
          e.preventDefault();
        } else if (e.key === '-') {
          c.applyZoom(c.scale / 1.2);
          e.preventDefault();
        } else if (e.key === '0') {
          setFitMode('width');
          e.preventDefault();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageDown':
        case ' ':
          c.next();
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'PageUp':
          c.prev();
          e.preventDefault();
          break;
        case 'Home':
          c.goToPage(1);
          e.preventDefault();
          break;
        case 'End':
          c.goToPage(numPages);
          e.preventDefault();
          break;
        case '+':
        case '=':
          c.applyZoom(c.scale * 1.2);
          break;
        case '-':
          c.applyZoom(c.scale / 1.2);
          break;
        case 'f':
          c.toggleFullscreen();
          break;
        case 'r':
          setRotation((r) => (r + 90) % 360);
          break;
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [numPages]);

  // العجلة: Ctrl ⇒ تكبير متمركز؛ بلا Ctrl وعند الملاءمة ⇒ تقليب (وعند التكبير: تمرير أصليّ pan).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = cmd.current;
      if (e.ctrlKey) {
        e.preventDefault();
        c.applyZoom(c.scale * (e.deltaY < 0 ? 1.1 : 0.9), { x: e.clientX, y: e.clientY });
        return;
      }
      if (c.zoomed) return; // مكبّر ⇒ pan أصليّ
      e.preventDefault();
      const now = Date.now();
      if (now - wheelLock.current < WHEEL_COOLDOWN) return;
      const d = e.deltaY || e.deltaX;
      if (Math.abs(d) < 8) return;
      wheelLock.current = now;
      if (d > 0) c.next();
      else c.prev();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // اللمس: سحب أفقيّ ⇒ تقليب (عند الملاءمة)؛ قرص ⇒ تكبير متمركز؛ نقرة مزدوجة ⇒ تبديل تكبير.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let pinchDist = 0;
    let pinchScale = 1;
    let startX = 0;
    let startY = 0;
    let lastTap = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist = dist(e.touches);
        pinchScale = cmd.current.scale;
      } else if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        cmd.current.applyZoom(pinchScale * (dist(e.touches) / pinchDist), mid(e.touches));
      }
    };
    const onEnd = (e: TouchEvent) => {
      const c = cmd.current;
      if (e.touches.length === 0 && pinchDist === 0) {
        const t = e.changedTouches[0];
        if (!t) return;
        const now = Date.now();
        if (now - lastTap < 300) {
          c.applyZoom(c.scale > 1 ? 1 : 2, { x: t.clientX, y: t.clientY });
          lastTap = 0;
          return;
        }
        lastTap = now;
        if (!c.zoomed) {
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            // RTL: سحب لليسار ⇒ التالية، لليمين ⇒ السابقة.
            if (dx < 0) c.next();
            else c.prev();
          }
        }
      }
      if (e.touches.length < 2) pinchDist = 0;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#111111] text-neutral-300">
        <p className="text-sm">تعذّر تحميل العدد حالياً.</p>
        <Link href={backHref} className="border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
          العودة إلى الأعداد
        </Link>
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="flex h-dvh flex-col bg-[#111111] outline-none">
      <div
        className={`shrink-0 transition-transform duration-300 ${chromeVisible ? 'translate-y-0' : '-translate-y-full'} ${isFullscreen ? 'absolute inset-x-0 top-0 z-30' : ''}`}
      >
        <ReaderToolbar
          title={title}
          currentPage={firstPage}
          numPages={numPages}
          scalePercent={Math.round(scale * 100)}
          backHref={backHref}
          downloadUrl={downloadUrl}
          isFullscreen={isFullscreen}
          onGoToPage={(n) => goToPage(n)}
          onZoomIn={() => applyZoom(scale * 1.2)}
          onZoomOut={() => applyZoom(scale / 1.2)}
          onFitWidth={() => setFitMode('width')}
          onFitPage={() => setFitMode('page')}
          onRotate={() => setRotation((r) => (r + 90) % 360)}
          onToggleFullscreen={toggleFullscreen}
          onPrint={print}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div ref={stageRef} className="relative flex flex-1 touch-pan-y overflow-auto overscroll-contain">
          {status === 'loading' || !doc ? (
            <div className="m-auto">
              <span
                className="block size-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
                aria-label="جارٍ التحميل"
              />
            </div>
          ) : (
            <div
              key={clampedIndex}
              className={`m-auto flex transform-gpu ${dir ? `ep-flip-${dir}` : ''}`}
              dir="rtl"
              style={{ gap: 0, padding: 16 }}
            >
              {spread.map((p) => (
                <ReaderCanvasPage
                  key={p}
                  doc={doc}
                  pageNumber={p}
                  scale={scale}
                  rotation={rotation}
                  cssWidth={pageW}
                  cssHeight={pageH}
                  render
                />
              ))}
            </div>
          )}

          {/* أسهم التقليب (سطح المكتب) — التالي يسار، السابق يمين (RTL) */}
          {!isMobile && doc ? (
            <>
              <button
                type="button"
                onClick={prev}
                disabled={clampedIndex <= 0}
                aria-label="الزوج السابق"
                className="absolute end-3 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-0"
              >
                ›
              </button>
              <button
                type="button"
                onClick={next}
                disabled={clampedIndex >= spreads.length - 1}
                aria-label="الزوج التالي"
                className="absolute start-3 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-0"
              >
                ‹
              </button>
            </>
          ) : null}
        </div>

        {isDesktop && doc ? (
          <ReaderThumbnails
            doc={doc}
            numPages={numPages}
            currentPage={firstPage}
            onJump={(n) => goToPage(n)}
            orientation="vertical"
            thumbWidth={64}
          />
        ) : null}
      </div>

      {isMobile && doc ? (
        <>
          <ReaderMobileBar currentPage={firstPage} numPages={numPages} onPrev={prev} onNext={next} />
          <ReaderThumbnails doc={doc} numPages={numPages} currentPage={firstPage} onJump={(n) => goToPage(n)} />
        </>
      ) : null}
    </div>
  );
}
