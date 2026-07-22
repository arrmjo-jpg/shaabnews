import { HeroCard } from '@/components/home/featured-hero';
import type { CategoryRef, FeedItem } from '@/lib/feed';

// شبكة "مميّزة" أعلى صفحة القسم (كرت رئيسي أوسع من نصف العرض + شبكة صغيرة، حتى 9 عناصر:
// 1 رئيسي + 8 صغيرة) — نسخة قسم من FeaturedHero (الرئيسية) لكن بفوارق متعمَّدة عن نمط
// الرئيسية.
export function CategoryFeaturedGrid({
  items,
  layout = 'default',
}: {
  items: FeedItem[];
  layout?: string;
  category?: CategoryRef | null;
}) {
  if (items.length === 0) return null;

  const [lead, ...rest] = items;
  const grid = rest.slice(0, 8);
  const hasGrid = grid.length > 0;

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start">
      <div
        className={`order-2 overflow-hidden lg:order-1 ${hasGrid ? 'lg:w-3/5' : 'w-full'}`}
      >
        <HeroCard item={lead} variant="lead" priority fixedHeight={false} />
      </div>
      {hasGrid && (
        <div className="order-1 grid grid-cols-2 gap-4 lg:order-2 lg:w-2/5">
          {grid.map((item) => (
            <div key={item.id} className="overflow-hidden">
              <HeroCard item={item} variant="grid" fixedHeight={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
