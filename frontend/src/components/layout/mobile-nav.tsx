'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ChevronDownIcon, CloseIcon, MenuIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { NavCategory } from '@/lib/site-settings';

import { SECTIONS_NAV } from './nav-data';

export type MobileNavPage = { id: number; title: string; href: string };

// القائمة الجانبيّة (Radix Sheet، Focus-trap + Escape + scroll-lock) — **الأقسام التحريريّة**
// (CMS، أول القائمة) + **روابط الوسائط** (فيديوهات/الريلز/البث/جدول الرياضة/أسعار الذهب/الطقس) +
// **الصفحات الثابتة** (CMS). الأقسام كانت محصورة سابقًا بالشريط الأفقيّ تحت الهيدر (hidden lg:flex
// في MainNav) — أي غائبة كليًّا على الموبايل؛ الآن مكرّرة هنا عمدًا (نفس navCategories المجلوبة
// أصلاً في SiteHeader — بلا طلب شبكة إضافي) لأنّ الشريط الأفقيّ يبقى مخفيًّا على الموبايل كما هو.
export function MobileNav({
  categories = [],
  staticPages = [],
  newspaperEnabled = false,
}: {
  /** أقسام CMS (show_in_header) — نفس المصدر المستخدَم في MainNav لسطح المكتب. */
  categories?: NavCategory[];
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

  // "فريق العمل" ليست صفحة CMS (لا تأتي عبر staticPages) — تُحقَن هنا يدويًّا قبل "أعلن معنا"
  // مباشرة (بحسب العنوان، لا فهرس ثابت — يبقى صحيحًا مهما تغيّر ترتيب/عدد صفحات الـCMS الأخرى).
  // غياب "أعلن معنا" (نادر) ⇒ تُلحَق بآخر القائمة بدل أن تختفي كليًّا.
  const teamPage: MobileNavPage = { id: -1, title: 'فريق العمل', href: '/team' };
  const advertiseIdx = staticPages.findIndex((p) => p.title === 'أعلن معنا');
  const pagesWithTeam =
    advertiseIdx === -1
      ? [...staticPages, teamPage]
      : [...staticPages.slice(0, advertiseIdx), teamPage, ...staticPages.slice(advertiseIdx)];

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
          {categories.length > 0 && (
            <>
              <p className="px-3 pb-1 text-caption font-bold text-muted">الأقسام</p>
              {categories.map((cat) =>
                cat.children.length > 0 ? (
                  <details key={cat.slug} className="group">
                    <summary className="flex list-none items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium text-fg transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                      <Link href={cat.href} onClick={close} className="flex-1">
                        {cat.name}
                      </Link>
                      <ChevronDownIcon
                        className="size-4 shrink-0 cursor-pointer text-muted transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <div className="flex flex-col gap-0.5 ps-4">
                      {cat.children.map((child) => (
                        <Link
                          key={child.slug}
                          href={child.href}
                          onClick={close}
                          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link
                    key={cat.slug}
                    href={cat.href}
                    onClick={close}
                    className="rounded-lg px-3 py-2.5 text-base font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    {cat.name}
                  </Link>
                ),
              )}
              <div className="my-2 border-t border-border" />
            </>
          )}

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

          {pagesWithTeam.length > 0 && (
            <>
              <div className="my-2 border-t border-border" />
              <p className="px-3 pb-1 text-caption font-bold text-muted">صفحات</p>
              {pagesWithTeam.map((p) => (
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
