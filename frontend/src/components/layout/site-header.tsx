import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { SiteLogo } from '@/components/branding/site-logo';
import { UserAuthSlot } from '@/components/auth/user-auth-slot';
import { getBreakingFeed } from '@/lib/feed';
import { getRecaptchaConfig } from '@/lib/recaptcha';
import { getNavCategories, getSiteSettings, resolveNewspaperGate } from '@/lib/site-settings';
import { getStaticPages } from '@/lib/static-pages';

import { BreakingBar } from './breaking-bar';
import { Container } from './container';
import { HeaderSearch } from './header-search';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';

// عزل ISR (ISR Restoration): منطقة تسجيل الدخول هي المكان الوحيد في هذا الهيدر الذي كان يحتاج
// cookies() (عبر getCurrentUser/getUnreadCount) — استخراجها إلى <UserAuthSlot variant="header">
// (عميل، يجلب /api/auth/session بعد mount) يُبقي بقيّة الهيدر (الشعار/التنقّل/البحث/رابط
// الجريدة) Server Component ثابتًا تمامًا، فيستعيد الصفحات تحت (site) أهليّة ISR.

// Sticky platform header. brand · primary nav · live + search + (auth area) + mobile trigger.
// Auth area is personalized: guest → login button; authenticated → avatar menu with unread badge.
export async function SiteHeader() {
  const [recaptcha, navCategories, pages, settings, breakingItems] = await Promise.all([
    getRecaptchaConfig(),
    getNavCategories(),
    getStaticPages('footer'),
    getSiteSettings(),
    getBreakingFeed(),
  ]);
  const newspaperEnabled = resolveNewspaperGate(settings) === 'enabled';
  const staticPages = pages.map((p) => ({ id: p.id, title: p.title, href: p.href }));

  return (
    <>
      {/* BreakingBar خارج <header>: على سطح المكتب يصير position:fixed أسفل الشاشة (انظر تعليق
          الشريط نفسه)، وbackdrop-blur-md على الهيدر يُنشئ containing block لأي fixed descendant
          بداخله (سلوك Chromium الفعليّ لـbackdrop-filter) فيثبّت الشريط عند أسفل الهيدر بدل أسفل
          الشاشة الفعليّ إن بقي بداخله. إخوة (siblings) لا أب/ابن يتفادى هذا تمامًا. */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
        <Container className="flex h-16 items-center gap-3">
          <Link href="/" aria-label="الصفحة الرئيسية" className="flex shrink-0 items-center">
            <SiteLogo variant="light" className="h-10 w-auto sm:h-11" priority />
          </Link>

          <div className="flex-1">
            <MainNav categories={navCategories} />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* الجريدة الرقمية — رابط حيّ لصفحة «عدد اليوم» (مشروط ببوّابة المنتج newspaper_enabled). */}
            {newspaperEnabled ? (
              <Link
                href="/epaper"
                className="hidden items-center gap-2 px-2.5 py-1.5 text-base font-medium text-fg transition-colors hover:text-primary sm:inline-flex"
                title="الجريدة الرقمية"
              >
                <span className="avatar inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Newspaper className="size-3.5" aria-hidden />
                </span>
                الجريدة الرقمية
              </Link>
            ) : null}

            {/* Search */}
            <HeaderSearch recaptchaEnabled={recaptcha?.enabled ?? false} />

            {/* Auth area — معزول عميليًّا، انظر التعليق أعلى الملف. حالة التحميل تعرض رابط الزائر
                نفسه (داخل UserAuthSlot) فلا تظهر أي قفزة تخطيطية (Layout Shift). */}
            <UserAuthSlot variant="header" />

            <MobileNav staticPages={staticPages} />
          </div>
        </Container>
      </header>

      <BreakingBar items={breakingItems} />
    </>
  );
}
