'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { addMonths, dayParts, monthGrid, monthLabel, shiftYmd, weekdayShortLabels } from '@/lib/sport/day';

// فلتر الأيّام — أُعيد تصميمه بالكامل (طلب المستخدم): عنصر واحد مضغوط (Pill دائريّة + سهم لأسفل)
// بدل صفّ أزرار أمس/اليوم/غداً + سهمي تنقّل سابقين. الضغط يفتح تقويمًا منبثقًا: صفّ اختصارات
// (أمس/اليوم/غداً) + شبكة شهر كامل لأيّ تاريخ آخر، حسابها في lib/sport/day.ts بدوال Date قياسيّة
// صرفة. التنقّل يبقى روابط ?date= صرفة كما كان (SSR بحت — منطق الفلترة/الـAPI/الـRoutes لم يتغيّر
// إطلاقًا، فقط طبقة العرض).
//
// عمدًا **بلا** Radix DropdownMenu (كانت المحاولة الأولى تستخدمه، أُعيد النظر بعد قياس فعليّ:
// أضاف ~38kB إلى /sport و/sport/[sport] تحديدًا — تبيّن أنّ Radix DropdownMenu غير مُحمَّل فعليًّا
// في أيّ صفحة رياضة أخرى اليوم في هذا الـBuild، فلا "مشاركة" حقيقيّة كانت لتُستفاد، والتقويم أصلًا
// ليس "قائمة" دلاليًّا فلا يحتاج قفل تركيز/تنقّل قوائم Radix). هذا Popover مبنيّ يدويًّا: زرّ +
// طبقة `absolute` بسيطة + إغلاق بالنقر خارجًا/Escape — بلا مكتبة جديدة، بلا Portal (لا عنصر أب هنا
// يقصّ overflow، تحقّقنا من ذلك في الشجرة الحاليّة).
export function DayFilter({
  selected,
  today,
  basePath = '/sport',
  live = false,
}: {
  selected: string;
  today: string;
  basePath?: string;
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(selected);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const href = (ymd: string) => {
    const p = new URLSearchParams();
    if (ymd !== today) p.set('date', ymd);
    if (live) p.set('live', '1');
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const sel = dayParts(selected, today);
  const isRelativeLabel = sel.label === 'أمس' || sel.label === 'اليوم' || sel.label === 'غداً';
  const triggerLabel = isRelativeLabel ? sel.label : sel.fullDate;

  const shortcuts = [
    { ymd: shiftYmd(today, -1), label: 'أمس' },
    { ymd: today, label: 'اليوم' },
    { ymd: shiftYmd(today, 1), label: 'غداً' },
  ];
  const weeks = monthGrid(viewMonth);
  const weekdayLabels = weekdayShortLabels();

  return (
    <div ref={rootRef} dir="rtl" className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setViewMonth(selected);
        }}
        className={
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-1.5 text-[13px] font-bold text-fg outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40 ' +
          (open ? 'bg-surface-2' : '')
        }
      >
        <ChevronDownIcon className="size-3.5" aria-hidden />
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="اختيار التاريخ"
          className="sport-card absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 border border-border bg-surface p-3 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-center gap-1.5">
            {shortcuts.map((c) => {
              const active = c.ymd === selected;
              return (
                <Link
                  key={c.ymd}
                  href={href(c.ymd)}
                  onClick={() => setOpen(false)}
                  className={
                    'rounded-full px-3 py-1 text-xs font-bold transition-colors ' +
                    (active ? 'bg-primary text-white' : 'bg-surface-2 text-fg hover:bg-border')
                  }
                >
                  {c.label}
                </Link>
              );
            })}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="الشهر السابق"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronRightIcon className="size-4" aria-hidden />
            </button>
            <span className="text-sm font-bold text-fg">{monthLabel(viewMonth)}</span>
            <button
              type="button"
              aria-label="الشهر التالي"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
            {weekdayLabels.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((cell) => {
              const isSelected = cell.ymd === selected;
              const isToday = cell.ymd === today;
              return (
                <Link
                  key={cell.ymd}
                  href={href(cell.ymd)}
                  onClick={() => setOpen(false)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={
                    'flex size-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors ' +
                    (!cell.inMonth
                      ? 'text-muted/40 hover:bg-surface-2'
                      : isSelected
                        ? 'bg-primary font-bold text-white'
                        : isToday
                          ? 'border border-primary text-fg'
                          : 'text-fg hover:bg-surface-2')
                  }
                >
                  {Number(cell.ymd.slice(8, 10))}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
