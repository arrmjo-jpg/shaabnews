import { AdZone } from '@/components/ads/ad-zone';
import { EconomySection } from '@/components/economy/economy-section';
import { BannerTripleSection } from '@/components/home/banner-category-card';
import { EditorialCategorySection } from '@/components/home/category-editorial-section';
import { CompactPairSection } from '@/components/home/compact-category-card';
import { CultureSection } from '@/components/home/culture-section';
import { GridCategorySection } from '@/components/home/grid-category-section';
import { IncidentsSection } from '@/components/home/incidents-section';
import { OpinionWritersSection } from '@/components/home/opinion-writers-section';
import { SportsSection } from '@/components/home/sports-section';
import { FeaturedHero } from '@/components/home/featured-hero';
import { LatestUpdates } from '@/components/home/latest-updates';
import { ReelsCarousel } from '@/components/home/reels-carousel';
import { TrendingSection } from '@/components/home/trending-section';
import { SubscribeBox } from '@/components/public-forms/subscribe-box';
import { VideoSection } from '@/components/videos/video-section';
import { getHeaderFeed, getHeroFeed, getMostReadFeed } from '@/lib/feed';
import { getReelsFeed } from '@/lib/reels';
import { getSiteSettings } from '@/lib/site-settings';

// الصفحة الرئيسية — كتل: الهيرو (is_featured) + آخر المستجدات (is_header) + كروسل الريلز
// + الأكثر شيوعا (الرائج) مع مكان إعلان. ISR = سقف أمان فقط (ساعة)؛ التحديث الفعليّ حدثيّ
// عبر وسوم feed:*/category:* (revalidateTag من الباك إند عند كلّ كتابة مؤثّرة).
export const revalidate = 36000;

// أقسام التصنيف في الهوم — **مصدر واحد، مرجعة بالـID الثابت** (لا slug؛ الـslug يتغيّر بالإدارة فيكسر القسم).
// الـID لا يتغيّر؛ يُحلّ وقت التشغيل إلى الـslug/الاسم الحاليّين (getCategoryById). fallbackTitle احتياط نادر.
// أضِف/احذف/أعد الترتيب هنا فقط. (IDs: شؤون برلمانية=180، نبض البلد=206، كتاب وأراء=24، حوادث=47، اخبار الأردن=205، عربي دولي=9، محليات=130، الرياضة=4، طلاب وجامعات=6.)
const CATEGORY_SECTIONS = [
  { variant: 'editorial', categoryId: 180, headingId: 'parliament-heading', fallbackTitle: 'شؤون برلمانية' },
  { variant: 'editorial', categoryId: 206, headingId: 'street-pulse-heading', fallbackTitle: 'نبض البلد' },
  { variant: 'opinion', categoryId: 24, headingId: 'opinion-heading', fallbackTitle: 'كتاب وأراء' },
  { variant: 'incidents', categoryId: 47, headingId: 'incidents-heading', fallbackTitle: 'حوادث' },
  { variant: 'editorial', categoryId: 205, headingId: 'jordan-news-heading', fallbackTitle: 'اخبار الأردن' },
  { variant: 'grid', categoryId: 9, headingId: 'arab-intl-heading', fallbackTitle: 'عربي دولي' },
  { variant: 'editorial', categoryId: 130, headingId: 'local-news-heading', fallbackTitle: 'محليات' },
  { variant: 'sports', categoryId: 4, headingId: 'sports-heading', fallbackTitle: 'رياضة' },
  { variant: 'culture', categoryId: 6, headingId: 'youth-heading', fallbackTitle: 'طلاب وجامعات' },
] as const;

export default async function Home() {
  const [heroItems, headerItems, reels, trending, settings] = await Promise.all([
    getHeroFeed(),
    getHeaderFeed(),
    getReelsFeed(),
    getMostReadFeed('ar', 9),
    getSiteSettings(),
  ]);
  return (
    <>
      <FeaturedHero items={heroItems} />
      {/* زوج إعلانات فوق «آخر المستجدات» — نفس نمط زوج أسفل الهيدر: صفّ نصف/نصف على الشاشات
          العادية ومتراكبان على الجوّال (RTL: الأوّل يمين، الثاني شمال). AdZone القائم 100%؛
          بلا إعلان ⇒ null، والغلاف بلا حشوة رأسيّة ⇒ صفر مساحة حين تفرغ المساحتان. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_akhr_almstjdat_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_akhr_almstjdat_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      <LatestUpdates items={headerItems} />
      {/* شريط الاشتراك في واتساب — أفقيّ بعرض الموقع، أسفل «آخر المستجدات» مباشرة. */}
      <SubscribeBox variant="bar" />
      {/* زوج إعلانات فوق قسم الريلز — نفس النمط: نصف/نصف على الشاشات العادية، متراكبان على
          الجوّال (RTL: الأوّل يمين، الثاني شمال). بلا إعلان ⇒ null بصفر مساحة. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_qsm_alrylz_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_qsm_alrylz_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      <ReelsCarousel
        items={reels.items}
        siteName={settings?.site_name || 'صدى الشعب الأخباري'}
        logo={settings?.logo_dark ?? settings?.logo_light ?? null}
      />
      {/* إعلان كبير واحد فوق «الأكثر شيوعا» — صفّ كامل بعرض الحاوية، يحمل توسيطه وهامشه
          بنفسه (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsm_alakthr_shywha"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <TrendingSection items={trending} />
      <EconomySection />
      {CATEGORY_SECTIONS.map((s) => {
        if (s.variant === 'opinion')
          return (
            <OpinionWritersSection
              key={s.headingId}
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          );
        if (s.variant === 'incidents')
          return (
            <IncidentsSection
              key={s.headingId}
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          );
        if (s.variant === 'grid')
          return (
            <GridCategorySection
              key={s.headingId}
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          );
        if (s.variant === 'sports')
          return (
            <SportsSection
              key={s.headingId}
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          );
        if (s.variant === 'culture')
          return (
            <CultureSection
              key={s.headingId}
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          );
        return (
          <EditorialCategorySection
            key={s.headingId}
            categoryId={s.categoryId}
            headingId={s.headingId}
            fallbackTitle={s.fallbackTitle}
          />
        );
      })}
      {/* قسمان متجاوران (بطاقتان مدمجتان): أخبار الفن + صحة وجمال */}
      <CompactPairSection
        left={{ categoryId: 10, headingId: 'art-heading', fallbackTitle: 'أخبار الفن' }}
        right={{ categoryId: 5, headingId: 'health-heading', fallbackTitle: 'صحة وجمال' }}
      />
      {/* ثلاثة أقسام متجاورة (بانر): منوعات + تكنولوجيا + وظائف */}
      <BannerTripleSection
        items={[
          { categoryId: 26, headingId: 'variety-heading', fallbackTitle: 'منوعات' },
          { categoryId: 8, headingId: 'tech-heading', fallbackTitle: 'تكنولوجيا' },
          { categoryId: 51, headingId: 'jobs-heading', fallbackTitle: 'وظائف' },
        ]}
      />
      {/* قسم الفيديو — آخر شيء فوق الفوتر (طلب المستخدم) */}
      <VideoSection />
    </>
  );
}
