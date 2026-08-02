'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CloseIcon, MenuIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { SECTIONS_NAV } from './nav-data';

export type MobileNavPage = { id: number; title: string; href: string };

// القائمة الجانبيّة (Radix Sheet، Focus-trap + Escape + scroll-lock) — **روابط الوسائط** (فيديوهات/الريلز/البث/جدول
// الرياضة/أسعار الذهب/الطقس) + **الصفحات الثابتة** (CMS). أقسام الموقع التحريريّة في الشريط الأفقيّ تحت الهيدر (لا تُكرَّر).
export function MobileNav({
  staticPages = [],
  newspaperEnabled = false,
}: {
  staticPages?: MobileNavPage[];
  /** بوّابة المنتج newspaper_enabled (نفس القيمة المحسوبة في SiteHeader) — تضيف "الجريدة
   * الرقمية" لهذي القائمة تمامًا كما تُضاف لشريط الوسائط على سطح المكتب (mediaSections في
   * (site)/layout.tsx). كانت غائبة هنا لأنّ SECTIONS_NAV يُستورَد خامًا بلا هذا المنطق. */
  newspaperEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const sections = newspaperEnabled
    ? [...SECTIONS_NAV, { label: 'الجريدة الرقمية', href: '/epaper' }]
    : SECTIONS_NAV;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="القائمة" className="lg:hidden">
          <MenuIcon className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="start" className="gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <SheetTitle className="font-heading text-lg font-bold text-fg">القائمة</SheetTitle>
          <SheetClose
            aria-label="إغلاق"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2"
          >
            <CloseIcon className="size-5" aria-hidden />
          </SheetClose>
        </div>

        <nav aria-label="التنقّل" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {sections.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={close}
              className="rounded-lg px-3 py-2.5 text-base font-medium text-fg transition-colors hover:bg-surface-2"
            >
              {item.label}
            </Link>
          ))}

          {staticPages.length > 0 && (
            <>
              <div className="my-2 border-t border-border" />
              <p className="px-3 pb-1 text-caption font-bold text-muted">صفحات</p>
              {staticPages.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  onClick={close}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {p.title}
                </Link>
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
