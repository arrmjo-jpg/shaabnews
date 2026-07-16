import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { SiteLogo } from '@/components/branding/site-logo';
import { UserIcon } from '@/components/icons';
import { getUnreadCount } from '@/lib/account';
import { getCurrentUser } from '@/lib/auth';
import { getRecaptchaConfig } from '@/lib/recaptcha';
import { getNavCategories, getSiteSettings } from '@/lib/site-settings';
import { getStaticPages } from '@/lib/static-pages';

import { BreakingBar } from './breaking-bar';
import { Container } from './container';
import { HeaderSearch } from './header-search';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';

// Sticky platform header. brand · primary nav · live + search + (auth area) + mobile trigger.
// Auth area is personalized: guest → login button; authenticated → avatar menu with unread badge.
export async function SiteHeader() {
  const [recaptcha, user, navCategories, pages, settings] = await Promise.all([
    getRecaptchaConfig(),
    getCurrentUser(),
    getNavCategories(),
    getStaticPages('footer'),
    getSiteSettings(),
  ]);
  const newspaperEnabled = settings?.newspaper_enabled ?? false;
  // الرابط يفتح «عرض الأعداد» (صفحة الهبوط بهيدر/فوتر الموقع): أحدث عدد + بحث برقم/تاريخ + جدار
  // الأغلفة. اختيار عدد/نتيجة بحث يفتح الـ PDF في القارئ المستقلّ. (لا قفز مباشر للعارض الأعمى.)
  const unread = user ? await getUnreadCount() : 0;
  const staticPages = pages.map((p) => ({ id: p.id, title: p.title, href: p.href }));

  return (
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

          {/* Auth area */}
          {user ? (
            <UserMenu name={user.name} avatar={user.avatar ?? null} isWriter={user.is_writer} unread={unread} />
          ) : (
            /* Guest: bare account icon on all widths — no background, color-only hover */
            <Link
              href="/login"
              aria-label="تسجيل الدخول"
              className="inline-flex size-10 items-center justify-center text-fg outline-none transition-colors hover:text-primary focus-visible:text-primary"
            >
              <UserIcon className="size-5" aria-hidden />
            </Link>
          )}

          <MobileNav staticPages={staticPages} />
        </div>
      </Container>

      <BreakingBar />
    </header>
  );
}
