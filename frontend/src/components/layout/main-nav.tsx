'use client';

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
            <DropdownMenu key={cat.slug} dir="rtl">
              <DropdownMenuTrigger className={TRIGGER}>
                {cat.name}
                <ChevronDownIcon className="size-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild className="text-base">
                  <Link href={cat.href}>كل {cat.name}</Link>
                </DropdownMenuItem>
                {cat.children.map((child) => (
                  <DropdownMenuItem key={child.slug} asChild className="text-base">
                    <Link href={child.href}>{child.name}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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

      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger className={TRIGGER}>
          المزيد
          <ChevronDownIcon className="size-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {MORE_NAV.map((item) => (
            <DropdownMenuItem key={item.label} asChild className="text-base">
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
