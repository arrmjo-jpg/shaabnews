'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { ChevronDownIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NavCategory } from '@/lib/site-settings';

import { MAIN_NAV, MORE_NAV } from './nav-data';

const LINK = 'rounded-md px-3 py-2 text-base font-bold text-fg transition-colors hover:text-primary';
const TRIGGER =
  'inline-flex items-center gap-1 rounded-md px-3 py-2 text-base font-bold text-fg outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=open]:text-primary';

// المدّتان (مللي ثانية) لفتح/إغلاق قائمة عبر hover — منفصلتان عن مدّة الأنيميشن البصريّة
// (تُضبَط في className المحتوى أدناه): OPEN_INTENT = فترة تروٍّ قبل الفتح فعليًّا، تمنع
// الفتح العرضيّ حين يمرّ المؤشّر سريعًا فوق عنصر أثناء التنقّل بين عناصر القائمة (لا وميض/رجّة
// عند المرور السريع). CLOSE_GRACE = مهلة قبل الإغلاق تسمح بنقل المؤشّر من الزرّ إلى المحتوى
// بلا "منطقة ميتة" تُغلق القائمة قبل الوصول.
const OPEN_INTENT_MS = 75;
const CLOSE_GRACE_MS = 150;

// Helper component that allows opening Radix DropdownMenu on hover with a slight debounce delay.
function HoverDropdownMenu({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تنظيف أيّ مؤقّت معلَّق عند إزالة المكوّن — يمنع setState على مكوّن غير مُركَّب.
  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (open || openTimeoutRef.current) return;
    openTimeoutRef.current = setTimeout(() => {
      openTimeoutRef.current = null;
      setOpen(true);
    }, OPEN_INTENT_MS);
  };

  const handleMouseLeave = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setOpen(false);
    }, CLOSE_GRACE_MS);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} dir="rtl">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative inline-flex"
      >
        <DropdownMenuTrigger asChild>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="nav-mega-menu-content data-[state=open]:duration-[220ms] data-[state=open]:ease-out data-[state=closed]:duration-[170ms] data-[state=closed]:ease-in data-[side=bottom]:data-[state=open]:slide-in-from-top-2 data-[side=bottom]:data-[state=closed]:slide-out-to-top-2 data-[side=top]:data-[state=open]:slide-in-from-bottom-2 data-[side=top]:data-[state=closed]:slide-out-to-bottom-2 data-[side=left]:data-[state=open]:slide-in-from-right-2 data-[side=left]:data-[state=closed]:slide-out-to-right-2 data-[side=right]:data-[state=open]:slide-in-from-left-2 data-[side=right]:data-[state=closed]:slide-out-to-left-2"
        >
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

// Desktop primary navigation. Source of truth = CMS categories flagged `show_in_header`
// (passed as `categories`). Falls back to the static placeholder nav when none are enabled.
export function MainNav({ categories = [] }: { categories?: NavCategory[] }) {
  if (categories.length > 0) {
    return (
      <nav aria-label="التنقّل الرئيسي" className="hidden items-center gap-0.5 lg:flex">
        {/* «الرئيسية» محذوفة من الهيدر على سطح المكتب — الشعار يكفي للعودة للرئيسية. تبقى على
            الجوّال عبر شريط التنقّل السفليّ (MobileBottomNav). */}
        {categories.map((cat) =>
          cat.children.length > 0 ? (
            <HoverDropdownMenu
              key={cat.slug}
              trigger={
                <button className={TRIGGER}>
                  {cat.name}
                  <ChevronDownIcon className="size-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
                </button>
              }
            >
              <DropdownMenuItem asChild className="text-base">
                <Link href={cat.href}>كل {cat.name}</Link>
              </DropdownMenuItem>
              {cat.children.map((child) => (
                <DropdownMenuItem key={child.slug} asChild className="text-base">
                  <Link href={child.href}>{child.name}</Link>
                </DropdownMenuItem>
              ))}
            </HoverDropdownMenu>
          ) : (
            <Link key={cat.slug} href={cat.href} className={LINK}>
              {cat.name}
            </Link>
          ),
        )}
      </nav>
    );
  }

  // Fallback: static placeholder nav (no CMS header categories enabled).
  return (
    <nav aria-label="التنقّل الرئيسي" className="hidden items-center gap-0.5 lg:flex">
      {MAIN_NAV.map((item) => (
        <Link key={item.label} href={item.href} className={LINK}>
          {item.label}
        </Link>
      ))}

      <HoverDropdownMenu
        trigger={
          <button className={TRIGGER}>
            المزيد
            <ChevronDownIcon className="size-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
          </button>
        }
      >
        {MORE_NAV.map((item) => (
          <DropdownMenuItem key={item.label} asChild className="text-base">
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </HoverDropdownMenu>
    </nav>
  );
}
