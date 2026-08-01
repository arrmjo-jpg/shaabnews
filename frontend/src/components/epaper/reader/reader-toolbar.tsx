'use client';

import {
  ArrowRight,
  Download,
  Maximize,
  Minimize,
  MoveHorizontal,
  Printer,
  RotateCw,
  Scan,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ReaderToolbarProps {
  title: string;
  currentPage: number;
  numPages: number;
  scalePercent: number;
  backHref: string;
  downloadUrl: string | null;
  isFullscreen: boolean;
  onGoToPage: (n: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotate: () => void;
  onToggleFullscreen: () => void;
  onPrint: () => void;
}

const btn =
  'inline-flex size-9 items-center justify-center rounded-sm text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 disabled:opacity-40';

export function ReaderToolbar({
  title,
  currentPage,
  numPages,
  scalePercent,
  backHref,
  downloadUrl,
  isFullscreen,
  onGoToPage,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onRotate,
  onToggleFullscreen,
  onPrint,
}: ReaderToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  // مزامنة الحقل مع الصفحة الحاليّة (من التمرير) ما لم يكن المستخدم يكتب فيه.
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const submitPage = () => {
    const n = Number.parseInt(pageInput, 10);
    if (Number.isInteger(n) && n >= 1 && n <= numPages) onGoToPage(n);
    else setPageInput(String(currentPage));
  };

  return (
    <header
      dir="rtl"
      className="flex h-14 shrink-0 items-center gap-1 border-b border-white/10 bg-[#1a1a1a] px-2 text-neutral-200 sm:gap-2 sm:px-3"
    >
      <Link href={backHref} aria-label="رجوع إلى الأعداد" className={btn}>
        <ArrowRight className="size-5" aria-hidden />
      </Link>

      <h1 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{title}</h1>

      {/* الصفحة الحاليّة / الإجمالي — حقل انتقال فوريّ */}
      <div className="hidden items-center gap-1 text-sm text-neutral-400 sm:flex">
        <input
          inputMode="numeric"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={submitPage}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitPage();
            }
          }}
          aria-label="الذهاب إلى صفحة"
          className="h-8 w-12 rounded-sm border border-white/15 bg-black/30 text-center text-neutral-100 outline-none focus:border-white/40"
        />
        <span className="tabular-nums">/ {numPages}</span>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

      <button type="button" onClick={onZoomOut} aria-label="تصغير" className={btn}>
        <ZoomOut className="size-5" aria-hidden />
      </button>
      <span className="hidden w-12 text-center text-xs tabular-nums text-neutral-400 sm:inline">
        {scalePercent}%
      </span>
      <button type="button" onClick={onZoomIn} aria-label="تكبير" className={btn}>
        <ZoomIn className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={onFitWidth} aria-label="ملاءمة العرض" title="ملاءمة العرض" className={btn}>
        <MoveHorizontal className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={onFitPage} aria-label="ملاءمة الصفحة" title="ملاءمة الصفحة" className={`hidden sm:inline-flex ${btn}`}>
        <Scan className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={onRotate} aria-label="تدوير" className={`hidden sm:inline-flex ${btn}`}>
        <RotateCw className="size-5" aria-hidden />
      </button>

      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

      {downloadUrl ? (
        <a href={downloadUrl} aria-label="تنزيل" title="تنزيل" className={btn}>
          <Download className="size-5" aria-hidden />
        </a>
      ) : null}
      <button type="button" onClick={onPrint} aria-label="طباعة" title="طباعة" className={`hidden sm:inline-flex ${btn}`}>
        <Printer className="size-5" aria-hidden />
      </button>
      <button type="button" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'} className={btn}>
        {isFullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
      </button>
    </header>
  );
}
