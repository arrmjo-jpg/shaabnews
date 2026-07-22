import type { ReactNode } from 'react';

import { AdZone } from '@/components/ads/ad-zone';
import { CategoryFeaturedGrid } from '@/components/category/category-featured-grid';
import type { CategoryRef, FeedItem } from '@/lib/feed';

// نقطة الدخول الوحيدة لعرض القسم (Section Rendering Unification — Phase B1). تقرأ
// appearance.layout من category وتتّخذ قرار تقسيم featured/feedItems بنفسها — بعد أن
// كان هذا القرار (switch على layout) يقع داخل CategoryPage مباشرة. لا تغيير بصريّ: نفس
// المنطق تمامًا (نفس أعداد التقطيع، نفس شرط page===1)، فقط نُقل مكانه إلى هنا.
//
// Phase B1 معماريّة بحتة: لا تزال CategoryFeaturedGrid (System B) تُستدعى داخليًّا كما هي
// دون أي تفكيك. تفكيكها إلى HeroRenderer/MagazineRenderer/FeaturedRenderer/DefaultRenderer
// مستقلّة (كل واحد ينقل جزءًا من JSX الشبكة الحاليّة، لا العقد) هو نطاق Phase B2 لاحقًا.
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
          <CategoryFeaturedGrid items={featured} layout={layout} category={category} />
          <AdZone zone="aalan_fasl_alaqsam_b" className="mb-6" />
        </>
      )}
      {children({ feedItems, layout })}
    </>
  );
}
