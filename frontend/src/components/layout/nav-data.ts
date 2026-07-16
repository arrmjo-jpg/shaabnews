// Header nav fallback + footer media links. Header primary nav is normally CMS-driven
// (getNavCategories — categories flagged `show_in_header`, see main-nav.tsx); MAIN_NAV/MORE_NAV
// below are the degraded-mode fallback for when the CMS has zero header categories configured.
// There's no reliable category slug to link to in that state, so category-shaped fallback entries
// route to site search instead of a dead `#` link. Footer STATIC PAGES come from the CMS
// (site-footer.tsx + lib/static-pages.ts), not from here.

export type NavLink = { label: string; href: string };

const searchHref = (label: string): string => `/search?q=${encodeURIComponent(label)}`;

export const MAIN_NAV: NavLink[] = [
  { label: 'أخبار', href: searchHref('أخبار') },
  { label: 'سياسة', href: searchHref('سياسة') },
  { label: 'اقتصاد', href: searchHref('اقتصاد') },
  { label: 'رياضة', href: '/sport' },
  { label: 'فيديو', href: '/videos' },
  { label: 'ريلز', href: '/reels' },
  { label: 'رأي', href: searchHref('رأي') },
];

export const MORE_NAV: NavLink[] = [
  { label: 'ثقافة وفنون', href: searchHref('ثقافة وفنون') },
  { label: 'تكنولوجيا', href: searchHref('تكنولوجيا') },
  { label: 'صحة', href: searchHref('صحة') },
  { label: 'منوعات', href: searchHref('منوعات') },
  { label: 'الجريدة الرقمية', href: '/epaper' },
];

// روابط الوسائط/الخدمات — على الموبايل في القائمة الجانبيّة (الهامبرغر)؛ على سطح المكتب في الشريط الأفقيّ تحت الهيدر.
export const SECTIONS_NAV: NavLink[] = [
  { label: 'فيديوهات', href: '/videos' },
  { label: 'الريلز', href: '/reels' },
  { label: 'البث المباشر', href: '/live' },
  { label: 'جدول الرياضة', href: '/sport' },
  { label: 'بورصة عمّان', href: '/bourse' },
  { label: 'اسعار الذهب', href: '/gold-prices' },
  { label: 'حالة الطقس', href: '/weather' },
];

// أقسام الموقع التحريريّة — على الموبايل في الشريط الأفقيّ تحت الهيدر (بلا الوسائط فيديو/ريلز وبلا الجريدة الرقمية).
export const MOBILE_SECTION_NAV: NavLink[] = [
  ...MAIN_NAV.filter((l) => l.label !== 'فيديو' && l.label !== 'ريلز'),
  ...MORE_NAV.filter((l) => l.label !== 'الجريدة الرقمية'),
];

// Footer "الوسائط" column — real internal site sections (not CMS data, just navigation).
// "الأقسام" (categories) column is CMS-driven — built in site-footer.tsx from getNavCategories(),
// not listed here. "بودكاست" (podcast) was dropped: no such feature exists anywhere in the app.
export const MEDIA_FOOTER_LINKS: NavLink[] = [
  { label: 'فيديو', href: '/videos' },
  { label: 'ريلز', href: '/reels' },
  { label: 'الجريدة الرقمية', href: '/epaper' },
  { label: 'بثّ مباشر', href: '/live' },
];

// Platform links not modeled as CMS pages. "الكتّاب" (writers directory) and "فرص العمل"
// (careers) were dropped: the writers directory page/components were removed in the site
// refactor and careers has no backend feature at all — neither had a real destination to link to.
export const PLATFORM_LINKS: NavLink[] = [
  { label: 'اتصل بنا', href: '/contact' },
  { label: 'أعلن معنا', href: '/advertise' },
];
