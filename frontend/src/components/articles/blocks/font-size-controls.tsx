'use client';

import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// أدوات التحكّم بحجم خط متن المقال — تكتب متغيّر CSS `--article-font-size` على <html>،
// و`article-body.tsx` يقرأه عبر inline style مُقيَّد لمتن المقال فقط (لا يمسّ .tiptap-content
// العام المستخدم في التعليقات/الصفحات الثابتة). حالة عرض بحتة (localStorage) — بلا اتصال شبكي.
export function FontSizeControls() {
  const [, setFontSize] = useState(19);

  useEffect(() => {
    const saved = localStorage.getItem('article-font-size');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 15 && parsed <= 27) {
        setFontSize(parsed);
        document.documentElement.style.setProperty('--article-font-size', `${parsed}px`);
      }
    }
  }, []);

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(27, Math.max(15, prev + delta));
      localStorage.setItem('article-font-size', String(next));
      document.documentElement.style.setProperty('--article-font-size', `${next}px`);
      return next;
    });
  };

  const resetFontSize = () => {
    setFontSize(19);
    localStorage.setItem('article-font-size', '19');
    document.documentElement.style.setProperty('--article-font-size', '19px');
  };

  return (
    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans select-none print:hidden" dir="rtl">
      <span className="text-muted font-bold me-1">التحكم بالخط:</span>
      <button
        type="button"
        onClick={() => changeFontSize(2)}
        className="flex h-8 w-8 items-center justify-center bg-surface-2 text-fg font-bold transition-colors hover:bg-surface-3 border border-border"
        title="تكبير الخط"
        aria-label="تكبير الخط"
      >
        <ZoomIn className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => changeFontSize(-2)}
        className="flex h-8 w-8 items-center justify-center bg-surface-2 text-fg font-bold transition-colors hover:bg-surface-3 border border-border"
        title="تصغير الخط"
        aria-label="تصغير الخط"
      >
        <ZoomOut className="size-4" />
      </button>
      <button
        type="button"
        onClick={resetFontSize}
        className="flex h-8 w-8 items-center justify-center bg-surface-2 text-fg font-bold transition-colors hover:bg-surface-3 border border-border"
        title="إعادة تعيين الخط"
        aria-label="إعادة تعيين الخط"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
