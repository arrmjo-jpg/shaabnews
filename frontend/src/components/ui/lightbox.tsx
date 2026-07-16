'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// معرض صور منبثق (Lightbox) — عرض/تكبير/تنقّل بين صور المتن. مكوّن عرض بحت (client) بلا أي
// اتصال شبكي أو منطق بيانات: يستقبل قائمة صور جاهزة من `article-body.tsx` عبر تفويض النقر على
// الصور داخل `.tiptap-content`. منقول بصريًّا كما هو من المشروع المرجعي.
export interface LightboxImage {
  src: string;
  alt: string;
  caption: string;
  photographer?: string;
  source?: string;
}

interface LightboxProps {
  isOpen: boolean;
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ isOpen, images, currentIndex, onClose, onNavigate }: LightboxProps) {
  const [zoom, setZoom] = useState(1);

  const navigate = useCallback(
    (direction: number) => {
      const nextIndex = (currentIndex + direction + images.length) % images.length;
      onNavigate(nextIndex);
    },
    [currentIndex, images.length, onNavigate],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') navigate(1);
      if (e.key === 'ArrowRight') navigate(-1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigate, onClose]);

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  if (!isOpen || images.length === 0) return null;

  const current = images[currentIndex] || images[0];

  const handleZoom = (amount: number) => {
    setZoom((z) => Math.min(3, Math.max(0.5, z + amount)));
  };

  const handleResetZoom = () => setZoom(1);

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col justify-between bg-black/95 backdrop-blur-md text-white select-none print:hidden transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="معرض الصور"
    >
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="إغلاق المعرض"
        >
          <X className="size-6" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleZoom(0.25)}
            className="flex h-9 px-2.5 items-center justify-center gap-1 rounded bg-white/10 text-white transition-colors hover:bg-white/20 text-xs font-bold"
            title="تكبير"
            aria-label="تكبير"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.25)}
            className="flex h-9 px-2.5 items-center justify-center gap-1 rounded bg-white/10 text-white transition-colors hover:bg-white/20 text-xs font-bold"
            title="تصغير"
            aria-label="تصغير"
          >
            <ZoomOut className="size-4" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="flex h-9 px-2.5 items-center justify-center gap-1 rounded bg-white/10 text-white transition-colors hover:bg-white/20 text-xs font-bold"
              title="إعادة تعيين التكبير"
              aria-label="إعادة تعيين التكبير"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>

        <span className="text-sm font-semibold bg-white/10 px-3 py-1 rounded">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-4">
        <div className="transition-transform duration-200 ease-out" style={{ transform: `scale(${zoom})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs high-res img */}
          <img
            src={current.src}
            alt={current.alt || 'صورة المعرض'}
            className="max-h-[75vh] max-w-[90vw] object-contain shadow-2xl pointer-events-auto"
            draggable={false}
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute right-4 md:right-8 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
              aria-label="الصورة السابقة"
            >
              <ChevronRight className="size-8" />
            </button>

            <button
              type="button"
              onClick={() => navigate(1)}
              className="absolute left-4 md:left-8 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-primary active:scale-95"
              aria-label="الصورة التالية"
            >
              <ChevronLeft className="size-8" />
            </button>
          </>
        )}
      </div>

      <div className="p-5 bg-gradient-to-t from-black/95 to-transparent text-center sm:text-right border-t border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {current.caption && (
            <p className="text-sm font-semibold text-white/90 pr-2 border-r-2 border-primary">{current.caption}</p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 text-xs text-white/50 shrink-0">
            {current.photographer && (
              <span>
                عدسة: <span className="font-bold text-white/80">{current.photographer}</span>
              </span>
            )}
            {current.photographer && current.source && <span className="text-white/20 select-none">|</span>}
            {current.source && (
              <span>
                المصدر: <span className="font-bold text-white/80">{current.source}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
