'use client';

import { useEffect, useRef, useState } from 'react';

import { CloseIcon, SearchIcon } from '@/components/icons';

// بحث الرياضة (Sprint 1.6 Phase 3) — نفس نمط HeaderSearch (توسيع/طيّ، Escape + نقر خارجي للإغلاق)
// لكن بلا أي جلب بيانات هنا: زرّ الهيدر يبقى Zero Data Fetch (قرار معماريّ مُقفَل)، النموذج يُرسل
// GET أصليًّا إلى /sport/search؛ صفحة النتائج (Server Component) هي من تستدعي البحث الفعليّ.
export function SportHeaderSearch() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'إغلاق البحث' : 'البحث'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-md text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {open ? <CloseIcon className="size-[18px]" aria-hidden /> : <SearchIcon className="size-[18px]" aria-hidden />}
      </button>

      {open && (
        <>
          {/* نقر خارجي/تعتيم للإغلاق — نفس نمط HeaderSearch */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-30 cursor-default bg-ink/20 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
              <form action="/sport/search" method="get" role="search" className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-3 rounded-lg bg-surface-2 px-4">
                  <SearchIcon className="size-5 shrink-0 text-muted" aria-hidden />
                  <input
                    ref={inputRef}
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder="ابحث عن فريق، بطولة، أو لاعب…"
                    className="h-12 w-full bg-transparent text-base text-fg outline-none placeholder:text-muted"
                  />
                </div>
                <button
                  type="submit"
                  className="h-12 shrink-0 rounded-md bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90"
                >
                  بحث
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
