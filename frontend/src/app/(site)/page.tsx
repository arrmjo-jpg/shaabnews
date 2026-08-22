import { Fragment } from 'react';

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
// إعلانات فوق قسم تصنيف: adPair زوج نصف/نصف (يمين ثمّ شمال بالـRTL)، وadWide إعلان كبير بعرض
// الحاوية. كلاهما اختياريّ ومستقلّ — تُرسَم فوق القسم بنفس ترتيب الحقول هنا (الزوج ثمّ الكبير).
// **الربط بالقسم لا بالموضع**: الإعلان يتبع تصنيفه أينما أُعيد ترتيب القائمة (لا يتبع رقم السطر).
type CategorySection = {
  variant: 'editorial' | 'opinion' | 'incidents' | 'grid' | 'sports' | 'culture';
  categoryId: number;
  headingId: string;
  fallbackTitle: string;
  adPair?: readonly [string, string];
  adWide?: string;
};

const CATEGORY_SECTIONS: readonly CategorySection[] = [
  {
    variant: 'editorial',
    categoryId: 180,
    headingId: 'parliament-heading',
    fallbackTitle: 'شؤون برلمانية',
    adPair: ['aalan_fwq_qsm_mjls_alama_ymyn', 'aalan_fwq_qsm_mjls_alama_shmal'],
  },
  {
    variant: 'editorial',
    categoryId: 206,
    headingId: 'street-pulse-heading',
    fallbackTitle: 'نبض البلد',
    adWide: 'aalan_fwq_qsm_wzara_altalym_alaaly_kbyr',
  },
  {
    variant: 'opinion',
    categoryId: 24,
    headingId: 'opinion-heading',
    fallbackTitle: 'كتاب وأراء',
    adPair: ['ktab_wara_aalan_ymyn', 'ktab_wara_aalan_shmal'],
  },
  {
    variant: 'incidents',
    categoryId: 47,
    headingId: 'incidents-heading',
    fallbackTitle: 'حوادث',
    adPair: ['aalan_fwq_qsm_hwadth_ymyn', 'aalan_fwq_qsm_hwadth_shmal'],
  },
  {
    variant: 'editorial',
    categoryId: 205,
    headingId: 'jordan-news-heading',
    fallbackTitle: 'اخبار الأردن',
    adWide: 'aalan_fwq_qsm_alardn_kbyr',
  },
  {
    variant: 'grid',
    categoryId: 9,
    headingId: 'arab-intl-heading',
    fallbackTitle: 'عربي دولي',
    adPair: ['aalan_fwq_qsm_arby_dwly_ymyn', 'aalan_fwq_qsm_arby_dwly_shmal'],
    adWide: 'aalan_kbyr_fwq_qsm_arby_dwly',
  },
  {
    variant: 'editorial',
    categoryId: 130,
    headingId: 'local-news-heading',
    fallbackTitle: 'محليات',
    adWide: 'aalan_kbyr_fwq_qsm_mhlyat',
  },
  {
    variant: 'sports',
    categoryId: 4,
    headingId: 'sports-heading',
    fallbackTitle: 'رياضة',
    adPair: ['aalan_fwq_qsm_alryada_ymyn', 'aalan_fwq_qsm_alryada_shmal'],
    adWide: 'aalan_kbyr_fwq_qsm_alryada',
  },
  {
    variant: 'culture',
    categoryId: 6,
    headingId: 'youth-heading',
    fallbackTitle: 'طلاب وجامعات',
    adPair: ['aalan_fwq_qsm_tlab_wjamaat_ymyn', 'aalan_fwq_qsm_tlab_wjamaat_shmal'],
  },
];

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
      {/* السطر الأول من زوجَي الإعلانات فوق «آخر المستجدات» — نفس نمط زوج أسفل الهيدر: صفّ
          نصف/نصف على الشاشات العادية ومتراكبان على الجوّال (RTL: الأوّل يمين، الثاني شمال).
          AdZone القائم 100%؛ بلا إعلان ⇒ null، والغلاف بلا حشوة رأسيّة ⇒ صفر مساحة حين تفرغ
          المساحتان (فيختفي الصفّ كاملًا بلا أثر). */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_qsm_akhr_almstjdat_alstr_alawl_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_qsm_akhr_almstjdat_alstr_alawl_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      {/* السطر الثاني — مطابق للأوّل تمامًا (نفس العرض والسلوك)، مستقلّ عنه: أيّ صفّ تفرغ
          مساحتاه ينعدم وحده دون أن يؤثّر على الآخر. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_qsm_akhr_almstjdat_alstr_althany_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_qsm_akhr_almstjdat_alstr_althany_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      {/* إعلان كبير أسفل الزوج مباشرةً وفوق «آخر المستجدات» — صفّ كامل بعرض الحاوية (1200px،
          مطابق لعرض المساحة)، يحمل توسيطه وهامشه بنفسه (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_fwq_qsm_akhr_akhr_almstjdat_kbyr"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <LatestUpdates items={headerItems} />
      {/* شريط الاشتراك في واتساب — أفقيّ بعرض الموقع، أسفل «آخر المستجدات» مباشرة. */}
      <SubscribeBox variant="bar" />
      {/* زوج إعلانات فوق قسم الريلز — نفس النمط: نصف/نصف على الشاشات العادية، متراكبان على
          الجوّال (RTL: الأوّل يمين، الثاني شمال). بلا إعلان ⇒ null بصفر مساحة. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_qsm_alrylz_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_qsm_alrylz_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      {/* إعلان كبير أسفل الزوج مباشرةً وفوق قسم الريلز — صفّ كامل بعرض الحاوية (1200px، مطابق
          لعرض المساحة)، يحمل توسيطه وهامشه بنفسه (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsm_alrylz"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <ReelsCarousel
        items={reels.items}
        siteName={settings?.site_name || 'صدى الشعب الأخباري'}
        logo={settings?.logo_dark ?? settings?.logo_light ?? null}
      />
      {/* زوج إعلانات فوق «الأكثر شيوعا» — نفس نمط بقيّة الأزواج: نصف/نصف على الشاشات العادية،
          متراكبان على الجوّال (RTL: الأوّل يمين، الثاني شمال). بلا إعلان ⇒ null بصفر مساحة. */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <AdZone zone="aalan_fwq_qsm_alakthr_shywaa_ymyn" className="mt-3 flex justify-center sm:flex-1" />
        <AdZone zone="aalan_fwq_qsm_alakthr_shywaa_shmal" className="mt-3 flex justify-center sm:flex-1" />
      </div>
      {/* إعلان كبير أسفل الزوج مباشرةً وفوق «الأكثر شيوعا» — صفّ كامل بعرض الحاوية، يحمل
          توسيطه وهامشه بنفسه (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsm_alakthr_shywaa"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <TrendingSection items={trending} />
      {/* إعلان كبير فوق قسم الاقتصاد — صفّ كامل بعرض الحاوية (1200px، مطابق لعرض المساحة)،
          يحمل توسيطه وهامشه بنفسه (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalant_kbyr_fwq_qsm_aqtsad"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      <EconomySection />
      {CATEGORY_SECTIONS.map((s) => {
        const SectionComponent =
          s.variant === 'opinion'
            ? OpinionWritersSection
            : s.variant === 'incidents'
              ? IncidentsSection
              : s.variant === 'grid'
                ? GridCategorySection
                : s.variant === 'sports'
                  ? SportsSection
                  : s.variant === 'culture'
                    ? CultureSection
                    : EditorialCategorySection;
        return (
          <Fragment key={s.headingId}>
            {/* إعلانات هذا القسم (اختياريّة) — الزوج ثمّ الكبير، بنفس أنماط بقيّة الصفحة.
                بلا إعلان ⇒ AdZone يعيد null، والغلاف بلا حشوة رأسيّة ⇒ صفر مساحة. */}
            {s.adPair && (
              <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
                <AdZone zone={s.adPair[0]} className="mt-3 flex justify-center sm:flex-1" />
                <AdZone zone={s.adPair[1]} className="mt-3 flex justify-center sm:flex-1" />
              </div>
            )}
            {s.adWide && (
              <AdZone
                zone={s.adWide}
                className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
              />
            )}
            <SectionComponent
              categoryId={s.categoryId}
              headingId={s.headingId}
              fallbackTitle={s.fallbackTitle}
            />
          </Fragment>
        );
      })}
      {/* إعلان كبير فوق كتلة «أخبار الفن + صحة وجمال» — الكتلة قسمان متجاوران، فالإعلان بعرض
          الحاوية كاملًا فوقهما معًا (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsm_akhbar_alfn"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      {/* قسمان متجاوران (بطاقتان مدمجتان): أخبار الفن + صحة وجمال */}
      <CompactPairSection
        left={{ categoryId: 10, headingId: 'art-heading', fallbackTitle: 'أخبار الفن' }}
        right={{ categoryId: 5, headingId: 'health-heading', fallbackTitle: 'صحة وجمال' }}
      />
      {/* إعلان كبير فوق كتلة «منوعات + تكنولوجيا + وظائف» — الكتلة ثلاثة أقسام متجاورة، فالإعلان
          بعرض الحاوية كاملًا فوقها معًا (بلا غلاف ⇒ بلا إعلان = صفر DOM/مساحة). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsm_mnwaat"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      {/* ثلاثة أقسام متجاورة (بانر): منوعات + تكنولوجيا + وظائف */}
      <BannerTripleSection
        items={[
          { categoryId: 26, headingId: 'variety-heading', fallbackTitle: 'منوعات' },
          { categoryId: 8, headingId: 'tech-heading', fallbackTitle: 'تكنولوجيا' },
          { categoryId: 51, headingId: 'jobs-heading', fallbackTitle: 'وظائف' },
        ]}
      />
      {/* إعلان كبير فوق قسم الفيديو — صفّ كامل بعرض الحاوية (بلا غلاف ⇒ بلا إعلان = صفر
          DOM/مساحة). ملاحظة: مفتاح المساحة فيه `qsk` لا `qsm` (خطأ مطبعيّ بالاسم بالإدارة،
          مُطابَق هنا حرفيًّا عمدًا — أي تصحيح لاحق يجب أن يتمّ بالمكانين معًا). */}
      <AdZone
        zone="aalan_kbyr_fwq_qsk_alfydyw"
        className="mx-auto mt-3 flex w-full max-w-[1200px] justify-center px-4 sm:px-6 lg:px-8"
      />
      {/* قسم الفيديو — آخر شيء فوق الفوتر (طلب المستخدم) */}
      <VideoSection />
    </>
  );
}
