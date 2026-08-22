import type { ReactNode } from 'react';

import { AdZone } from '@/components/ads/ad-zone';
import { FeaturedRenderer } from '@/components/sections/renderers/FeaturedRenderer';
import { HeroRenderer } from '@/components/sections/renderers/HeroRenderer';
import { MagazineRenderer } from '@/components/sections/renderers/MagazineRenderer';
import type { CategoryRef, FeedItem } from '@/lib/feed';

// نقطة الدخول الوحيدة لعرض القسم (Section Rendering Unification — Phase B1). تقرأ
// appearance.layout من category وتتّخذ قرار تقسيم featured/feedItems بنفسها — بعد أن
// كان هذا القرار (switch على layout) يقع داخل CategoryPage مباشرة. لا تغيير بصريّ: نفس
// المنطق تمامًا (نفس أعداد التقطيع، نفس شرط page===1)، فقط نُقل مكانه إلى هنا.
//
// Phase B2 (Renderer Consolidation) اكتمل استخراج الأشرطة الثلاثة الحيّة: featured
// (FeaturedRenderer، B2.1) → magazine (MagazineRenderer، B2.2) → hero (HeroRenderer، B2.3a).
// نقطة التوزيع الوحيدة على layout تبقى هنا فقط، لا تتكرّر داخل أيّ Renderer. CategoryFeaturedGrid
// (System B) لم يعد مُستدعىً من هنا إطلاقًا — يبقى فقط لتنظيفه في B2.4 (Retire).
//
// children كـ render-prop لا ReactNode عاديّ: القسم المميّز (featured) وبقيّة التغذية
// (feedItems) يعتمدان على نفس قرار التقسيم، ولا يمكن لهذا المكوّن حساب feedItems وتمريرها
// لأعلى إلى children جاهزة الإنشاء لو كانت ReactNode عاديًا — لذا الحاجة لدالة.
export type SectionLayout = 'default' | 'hero' | 'magazine' | 'featured';

const FEATURED_SLICE_COUNT: Record<Exclude<SectionLayout, 'default'>, number> = {
  hero: 10,
  magazine: 9,
  featured: 5,
};

export function SectionRenderer({
  category,
  items,
  page,
  children,
}: {
  category: CategoryRef | null;
  items: FeedItem[];
  page: number;
  children: (ctx: { feedItems: FeedItem[]; layout: SectionLayout }) => ReactNode;
}) {
  const layout = (category?.appearance?.layout ?? 'default') as SectionLayout;
  const showFeatured = layout !== 'default' && page === 1;

  let featured: FeedItem[] = [];
  let feedItems = items;

  if (showFeatured) {
    const count = FEATURED_SLICE_COUNT[layout];
    featured = items.slice(0, count);
    feedItems = items.slice(count);
  }

  return (
    <>
      {showFeatured && featured.length > 0 && (
        <>
          {layout === 'featured' ? (
            <FeaturedRenderer items={featured} />
          ) : layout === 'magazine' ? (
            <MagazineRenderer items={featured} />
          ) : (
            <HeroRenderer items={featured} category={category} />
          )}
          <AdZone zone="fasl_aryd_bad_alakhbar_almmyza_bsfhat_alaqsam" className="mb-6" />
        </>
      )}
      {children({ feedItems, layout })}
    </>
  );
}
