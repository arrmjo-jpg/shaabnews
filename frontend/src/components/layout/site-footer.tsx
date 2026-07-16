import Link from 'next/link';

import { SiteLogo } from '@/components/branding/site-logo';
import { WhatsappIcon } from '@/components/icons';
import { getNavCategories, getSiteSettings } from '@/lib/site-settings';
import { getStaticPages, type StaticPage } from '@/lib/static-pages';

import { Container } from './container';
import { CookiePolicyModal } from './cookie-policy-modal';
import { MEDIA_FOOTER_LINKS, PLATFORM_LINKS } from './nav-data';
import { ScrollTopButton } from './scroll-top-button';
import { socialEntries } from './social-map';

// Legal / policy pages go in the bottom bar; everything else goes in the "المنصّة" column.
// The CMS has no legal flag, so we classify by title keywords (defaults to the column when unsure).
const LEGAL_RE = /سياس|شروط|أحكام|خصوص|ارتباط|cookie|privacy|terms/i;
const isLegal = (p: StaticPage) => LEGAL_RE.test(p.title);

// Large premium footer (DARK), classic 4-column layout. Brand = logo_dark; social = Site Settings;
// "الأقسام" = CMS categories (getNavCategories, same source as the header nav); "الوسائط" = real
// internal site sections; "المنصّة" = CMS info pages + platform links. Zero hardcoded page links.
// Failed API → CMS-driven sections simply hide (no placeholder fallback).
export async function SiteFooter() {
  const [settings, pages, categories] = await Promise.all([
    getSiteSettings(),
    getStaticPages('footer'),
    getNavCategories(),
  ]);

  const siteName = settings?.site_name?.trim() || 'الشعب';
  const year = new Date().getFullYear();
  const copyright = settings?.copyright?.trim() || `© ${year} ${siteName} — جميع الحقوق محفوظة.`;
  // نصّ سياسة الكوكيز من إعدادات الموقع — فارغ ⇒ المودال/الزرّ لا يظهران إطلاقًا.
  const cookiePolicy = settings?.cookie_policy?.trim() || '';

  const legalPages = pages.filter(isLegal);
  const infoPages = pages.filter((p) => !isLegal(p));

  const social = socialEntries(settings?.social);

  // بيانات فوتر الموبايل (المرجعيّ) — من إعدادات الموقع، بلا تلفيق (واتساب مُفصَل عن صفّ التواصل).
  const description = settings?.description?.trim() || null;
  const phone = settings?.phone?.trim() || null;
  const email = settings?.email?.trim() || null;
  const whatsappUrl = social.find((s) => s.key === 'whatsapp')?.url ?? null;
  const socialRow = social.filter((s) => s.key !== 'whatsapp');

  return (
    <>
      {/* فوتر الموبايل (تصميم مرجعيّ) — أبيض + شريط أحمر داكن، يحلّ محلّ الفوتر الأسود على الموبايل */}
      <footer className="lg:hidden">
        <div className="border-t border-border bg-white text-fg">
          <div className="mx-auto w-full max-w-[430px] px-4 py-7 text-center">
            <Link href="/" aria-label="الصفحة الرئيسية" className="inline-flex items-center justify-center">
              <SiteLogo variant="light" className="mx-auto h-10 w-auto" />
            </Link>
            <p className="mt-3 text-sm font-black text-primary">{siteName}</p>
            <p className="mt-2 text-xs font-semibold text-muted">{copyright}</p>
            <CookiePolicyModal
              text={cookiePolicy}
              className="mt-2 text-xs font-bold text-primary underline underline-offset-4"
            />
            {description && <p className="mt-3 text-[13px] font-medium leading-6 text-muted">{description}</p>}
            {socialRow.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {socialRow.map(({ key, url, Icon, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="avatar inline-flex size-11 items-center justify-center rounded-full bg-ink text-white"
                  >
                    <Icon className="size-5" aria-hidden />
                  </a>
                ))}
              </div>
            )}
            {(phone || email) && (
              <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs font-semibold text-muted">
                {phone && (
                  <div className="bg-surface-2 px-2 py-2">
                    <p className="text-muted">الهاتف</p>
                    <p className="mt-1 text-[11px] leading-4 text-fg" dir="ltr">
                      {phone}
                    </p>
                  </div>
                )}
                {email && (
                  <div className="bg-surface-2 px-2 py-2">
                    <p className="text-muted">البريد</p>
                    <p className="mt-1 text-[11px] leading-4 text-fg" dir="ltr">
                      {email}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="relative bg-[#5c0000]">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="واتساب"
              className="avatar absolute -top-5 end-4 inline-flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-lg"
            >
              <WhatsappIcon className="size-5" aria-hidden />
            </a>
          )}
          <ScrollTopButton className="avatar absolute -top-5 start-4 inline-flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-lg" />
          <div className="mx-auto w-full max-w-[430px] px-4 py-3 text-center">
            <p className="text-xs font-semibold text-white/95">{copyright}</p>
          </div>
        </div>
      </footer>

      {/* فوتر سطح المكتب — تصميم premium: خطّ هويّة علويّ متدرّج + لوجو كبير + وصف الموقع (من
          الإعدادات) أسفله + ترويسات أعمدة بشارة حمراء + شريط تواصل + شريط سفليّ بعودة لأعلى. */}
      <footer className="mt-16 hidden lg:block">
        {/* خطّ الهويّة العلويّ */}
        <div className="h-1 bg-gradient-to-l from-primary via-primary/50 to-transparent" aria-hidden />
        <div className="bg-ink text-white">
          <Container className="py-16">
            <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
              {/* العلامة: لوجو أكبر + وصف الموقع من الإعدادات + التواصل الاجتماعيّ */}
              <div className="flex flex-col gap-5">
                <Link href="/" aria-label="الصفحة الرئيسية" className="self-start">
                  <SiteLogo variant="dark" className="h-16 w-auto" />
                </Link>
                {description && (
                  <p className="max-w-md text-[15px] font-medium leading-8 text-white/65">{description}</p>
                )}
                {social.length > 0 && (
                  <div className="mt-1 flex items-center gap-2.5">
                    {social.map(({ key, url, Icon, label }) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      >
                        <Icon className="size-5" aria-hidden />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* الأقسام — من CMS (نفس مصدر تنقّل الهيدر)؛ عمود يختفي إن لم توجد أقسام مفعَّلة. */}
              {categories.length > 0 && (
                <nav aria-label="الأقسام" className="flex flex-col gap-4">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-white">
                    <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
                    الأقسام
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {categories.map((cat) => (
                      <li key={cat.slug}>
                        <Link
                          href={`/category/${encodeURIComponent(cat.slug)}`}
                          className="inline-block text-sm text-white/60 transition-[color,padding] hover:ps-1 hover:text-white motion-reduce:transition-none"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {/* الوسائط — أقسام الموقع الداخليّة (روابط حقيقيّة، ليست بيانات CMS). */}
              <nav aria-label="الوسائط" className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-white">
                  <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
                  الوسائط
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {MEDIA_FOOTER_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="inline-block text-sm text-white/60 transition-[color,padding] hover:ps-1 hover:text-white motion-reduce:transition-none"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* المنصّة — CMS info pages + platform placeholders */}
              <nav aria-label="المنصّة" className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-white">
                  <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
                  المنصّة
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {infoPages.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={p.href}
                        className="inline-block text-sm text-white/60 transition-[color,padding] hover:ps-1 hover:text-white motion-reduce:transition-none"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                  {PLATFORM_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="inline-block text-sm text-white/60 transition-[color,padding] hover:ps-1 hover:text-white motion-reduce:transition-none"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </Container>

          {/* الشريط السفليّ — سطر واحد: الحقوق + الروابط القانونيّة (العودة لأعلى = الزرّ العائم القائم) */}
          <div className="border-t border-white/10">
            <Container className="flex items-center justify-between gap-4 py-5 text-sm text-white/55">
              <span className="min-w-0">{copyright}</span>
              {legalPages.length > 0 && (
                <nav aria-label="روابط قانونيّة" className="flex shrink-0 items-center gap-x-5">
                  {legalPages.map((p) => (
                    <Link key={p.id} href={p.href} className="whitespace-nowrap transition-colors hover:text-white">
                      {p.title}
                    </Link>
                  ))}
                </nav>
              )}
            </Container>
          </div>
        </div>
      </footer>
    </>
  );
}
