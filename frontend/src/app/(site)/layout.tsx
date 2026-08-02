import { AdZone } from '@/components/ads/ad-zone';
import { CookiePolicyModal } from '@/components/layout/cookie-policy-modal';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { MobileTopToggleBanner } from '@/components/layout/mobile-top-toggle-banner';
import { MOBILE_SECTION_NAV, SECTIONS_NAV } from '@/components/layout/nav-data';
import { SectionsBar } from '@/components/layout/sections-bar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { LeagueMatchesTicker } from '@/components/sport/league-matches-ticker';
import { getMatchBar } from '@/lib/match-bar';
import { getNavCategories, getSiteSettings, resolveNewspaperGate } from '@/lib/site-settings';

// سقف ISR على مستوى الـlayout — لا الصفحة — لأنّ SiteHeader/SiteFooter (يعتمدان
// getSiteSettings/getNavCategories) يُعرَّفان هنا، لا في أيّ صفحة فرديّة. أي صفحة بلا
// revalidate خاصّ بها كانت تُصبح Static أبديّاً (مقروءة وقت `docker build` فقط، حيث
// API_BASE_URL فارغ عمداً — راجع Dockerfile) بلا أي آلية تعافٍ ذاتي، وهذا ما جمّد
// /login وأخواتها فعليًّا (مُثبَت تجريبيًّا 2026-07-18). 36000 يطابق القيمة المستخدَمة
// فعليًّا في 18 من 19 صفحة مُهيَّأة أصلاً في هذا الموقع (Article/Category/Homepage/…)
// فلا يُقصِّر كاش أيٍّ منها (Next يأخذ الأصغر بين الـlayout والصفحة) — يُقصِّر فقط
// /pages/[slug] (كان 86400) إلى 36000، أثر مهمَل لمحتوى نادر التغيّر. الصفحات الأقصر
// فعلاً (bourse/gold-prices 300، weather 900) تبقى كما هي (الأصغر يفوز دومًا). التحديث
// الفعليّ يبقى حدثيًّا عبر revalidateTag('site-settings') — هذا الرقم سقف أمان فقط.
export const revalidate = 36000;

// Public news-site chrome. شريط أسفل الهيدر متجاوب: الموبايل = أقسام الموقع التحريريّة، سطح المكتب = روابط الوسائط.
// (الوسائط على الموبايل في القائمة الجانبيّة + الشريط السفليّ.) لوحة /account خارج هذه المجموعة بقالب خاصّ.
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, matchBarMatches, navCategories] = await Promise.all([
    getSiteSettings(),
    getMatchBar(),
    getNavCategories(),
  ]);
  // ظهور الرابط سياسة "معروفة ومفعّلة فقط" — غير معروف/معطّل كلاهما يُخفيان الرابط (سلوك
  // قائم لم يتغيّر)؛ خلافاً لبوّابة notFound() في epaper/newspaper، التي تفرّق الآن بين
  // 'unknown' و'disabled' (راجع resolveNewspaperGate).
  const mediaSections = resolveNewspaperGate(settings) === 'enabled'
    ? [...SECTIONS_NAV, { label: 'الجريدة الرقمية', href: '/epaper' }]
    : SECTIONS_NAV;

  // أقسام الموبايل الحقيقية (CMS، نفس مصدر MainNav على سطح المكتب) — بدل التسميات الثابتة
  // القديمة (MOBILE_SECTION_NAV) اللي كانت تربط لصفحة بحث، لا لقسم حقيقي. مستوى أوّل فقط
  // (بلا الأبناء) يناسب شريطاً أفقياً قابلاً للسكرول. Fallback لنفس القائمة الثابتة القديمة
  // حين لا توجد أقسام مفعَّلة بالـCMS — يطابق سلوك MainNav (main-nav.tsx) تماماً.
  const mobileCategorySections = navCategories.length > 0
    ? navCategories.map((cat) => ({ label: cat.name, href: cat.href }))
    : MOBILE_SECTION_NAV;

  return (
    <>
      <MobileTopToggleBanner />
      {/* إعلان فوق الهيدر — أوّل عنصر في الصفحة (AdZone القائم: client، no-store، تتبّع كامل).
          الإبداع يتوسّط أفقيًّا؛ بلا إعلان ⇒ null (صفر DOM/مساحة فوق الهيدر). */}
      <AdZone zone="aalan_fwq_alhydr" className="flex justify-center px-4 py-2" />
      <SiteHeader />
      {/* الموبايل: أقسام الموقع التحريريّة الحقيقية من الـCMS (سكرول) */}
      <SectionsBar items={mobileCategorySections} className="lg:hidden" />
      {/* سطح المكتب: روابط الوسائط (كما كان) */}
      <SectionsBar items={mediaSections} className="hidden lg:block" />
      {/* شريط المباريات — من Laravel حصريًّا (GET /api/v1/match-bar)، تحت شريط الريلز/الفيديو،
          آخر عنصر في كتلة الهيدر (طلب المستخدم). القرار (معطَّل/بطولات مميَّزة/دوريّات) بالكامل
          تحريريّ عبر لوحة الإدارة — لا معرّف بطولة مُثبَّت هنا. */}
      <LeagueMatchesTicker matches={matchBarMatches} />
      {/* إعلانان أسفل الهيدر مباشرة — صفّ واحد على الشاشات العادية (نصف/نصف بفاصل صغير)،
          متراكبان عموديًّا على الجوّال. AdZone القائم 100%؛ بلا إعلان ⇒ null (الغلاف بلا
          حشوة/هوامش ⇒ ارتفاعه صفر حين تفرغ المساحتان — لا فراغ ولا placeholder). RTL:
          الأوّل = يمين، الثاني = شمال. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        {/* mt-3 على كلّ إعلان (لا الغلاف): يفصل عن الهيدر فقط حين يوجد إعلان فعلًا. */}
        <AdZone zone="aalan_asfl_alhydr_mbashra_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_asfl_alhydr_mbashra_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      {/* إعلان كبير أسفل الزوج — صفّ كامل بنفس عرض الحاوية، يحمل توسيطه وهامشه بنفسه
          (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_asfl_alhydr_mbashra"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {/* فاصل يمنع شريط التنقّل السفليّ الثابت من تغطية آخر الفوتر على الموبايل */}
      <div className="h-14 lg:hidden" aria-hidden />
      {/* فاصل مطابق لشريط العاجل الثابت أسفل الشاشة على سطح المكتب (BreakingBar، انظر site-header.tsx) —
          نفس فكرة الفاصل أعلاه لكن بالاتجاه المعاكس (lg فما فوق). */}
      <div className="hidden h-14 lg:block" aria-hidden />
      <MobileBottomNav />
      {/* موافقة سياسة الكوكيز — تُفتح تلقائيًّا وسط الشاشة عند أوّل زيارة فقط؛ الإغلاق يُذكَر
          في localStorage فلا تظهر ثانية (زرّا الفوتر يبقيان للفتح اليدويّ). نصّ فارغ ⇒ لا شيء. */}
      <CookiePolicyModal
        text={settings?.cookie_policy?.trim() || ''}
        hideTrigger
        autoOpenKey="acm_cookie_ack"
      />
    </>
  );
}
