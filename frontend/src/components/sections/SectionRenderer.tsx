import type { ReactNode } from 'react';

import { AdZone } from '@/components/ads/ad-zone';
import { CategoryFeaturedGrid } from '@/components/category/category-featured-grid';
import { FeaturedRenderer } from '@/components/sections/renderers/FeaturedRenderer';
import { MagazineRenderer } from '@/components/sections/renderers/MagazineRenderer';
import type { CategoryRef, FeedItem } from '@/lib/feed';

// نقطة الدخول الوحيدة لعرض القسم (Section Rendering Unification — Phase B1). تقرأ
// appearance.layout من category وتتّخذ قرار تقسيم featured/feedItems بنفسها — بعد أن
// كان هذا القرار (switch على layout) يقع داخل CategoryPage مباشرة. لا تغيير بصريّ: نفس
// المنطق تمامًا (نفس أعداد التقطيع، نفس شرط page===1)، فقط نُقل مكانه إلى هنا.
//
// Phase B2 (Renderer Consolidation) بدأت بتفكيك layout==='featured' إلى FeaturedRenderer
// المستقلّ (B2.1)، ثمّ layout==='magazine' إلى MagazineRenderer (B2.2) — نقطة التوزيع الوحيدة
// على layout تبقى هنا فقط، لا تتكرّر داخل أيّ Renderer. hero ما زال يمرّ عبر CategoryFeaturedGrid
// (System B) ريثما يُستخرج بدوره (B2.3) بنفس الطريقة.
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
            <CategoryFeaturedGrid items={featured} layout={layout} category={category} />
          )}
          <AdZone zone="aalan_fasl_alaqsam_b" className="mb-6" />
        </>
      )}
      {children({ feedItems, layout })}
    </>
  );
}
