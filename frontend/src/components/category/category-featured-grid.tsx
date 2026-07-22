import Link from 'next/link';

import { HeroCard } from '@/components/home/featured-hero';
import type { CategoryRef, FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

function CategoryHeroGridCard({ item, isCenter = false }: { item: FeedItem; isCenter?: boolean }) {
  return (
    <article className="flex flex-col bg-surface-1 border border-border group relative h-full">
      {/* Link covering the card */}
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      {/* Image Wrap */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.imageAlt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-102"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-surface-3" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        <h3 className={`font-heading font-bold leading-snug text-fg group-hover:text-primary transition-colors ${isCenter ? 'text-base md:text-lg line-clamp-2' : 'text-sm line-clamp-2'}`}>
          {item.title}
        </h3>
        {isCenter && item.excerpt && (
          <p className="text-xs text-muted mt-2 line-clamp-3 leading-relaxed hidden sm:block">
            {item.excerpt}
          </p>
        )}
        {item.publishedAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-auto pt-2">
            <svg
              className="size-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <time dateTime={item.publishedAt}>
              {formatRelativeTime(item.publishedAt)}
            </time>
          </div>
        )}
      </div>
    </article>
  );
}

function CategoryMegaPostCard({ item, borderColor }: { item: FeedItem; borderColor: string }) {
  return (
    <article className="mega-post-card u-clickable-card mega-post-card--lifestyle">
      {/* Content block */}
      <div 
        className="mega-post-card__content" 
        data-testid="mega-post-card-content" 
        style={{ borderColor }}
      >
        <Link className="u-clickable-card__link mega-post-card__content__title-link" href={item.href}>
          <h2 className="mega-post-card__content__title">
            {item.title}
          </h2>
        </Link>
        {item.excerpt && (
          <p className="mega-post-card__content__excerpt u-hidden--mobile">
            {item.excerpt}
          </p>
        )}
      </div>

      {/* Picture block */}
      <picture className="responsive-picture mega-post-card__picture" data-testid="responsive-picture">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="responsive-picture__image mega-post-card__picture__image"
            src={item.image}
            alt={item.imageAlt}
            fetchPriority="high"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-surface-3" />
        )}
      </picture>
    </article>
  );
}

// شبكة "مميّزة" أعلى صفحة القسم (كرت رئيسي أوسع من نصف العرض + شبكة صغيرة، حتى 9 عناصر:
// 1 رئيسي + 8 صغيرة) — نسخة قسم من FeaturedHero (الرئيسية) لكن بفوارق متعمَّدة عن نمط
// الرئيسية.
export function CategoryFeaturedGrid({
  items,
  layout = 'default',
  category,
}: {
  items: FeedItem[];
  layout?: string;
  category?: CategoryRef | null;
}) {
  if (items.length === 0) return null;

  if (layout === 'hero') {
    const borderColor = category?.appearance?.border?.color || 'var(--primary)';
    
    return (
      <div className="mb-8">
        {/* Top Standalone Card (Item 0) */}
        <div className="mb-6">
          <CategoryMegaPostCard item={items[0]} borderColor={borderColor} />
        </div>

        {/* Grid of 9 items (Items 1 to 9) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {/* Center Card (Item 1) */}
          {items[1] && (
            <div className="col-span-2 row-span-1 lg:col-start-2 lg:col-span-2 lg:row-start-1 lg:row-span-2">
              <CategoryHeroGridCard item={items[1]} isCenter={true} />
            </div>
          )}

          {/* Item 2: Top-Right */}
          {items[2] && (
            <div className="col-span-1 row-start-2 lg:col-start-4 lg:row-start-1">
              <CategoryHeroGridCard item={items[2]} />
            </div>
          )}

          {/* Item 3: Bottom-Right */}
          {items[3] && (
            <div className="col-span-1 row-start-2 lg:col-start-4 lg:row-start-2">
              <CategoryHeroGridCard item={items[3]} />
            </div>
          )}

          {/* Item 4: Top-Left */}
          {items[4] && (
            <div className="col-span-1 row-start-3 lg:col-start-1 lg:row-start-1">
              <CategoryHeroGridCard item={items[4]} />
            </div>
          )}

          {/* Item 5: Bottom-Left */}
          {items[5] && (
            <div className="col-span-1 row-start-3 lg:col-start-1 lg:row-start-2">
              <CategoryHeroGridCard item={items[5]} />
            </div>
          )}

          {/* Item 6: Bottom Row 1 (Rightmost in RTL) */}
          {items[6] && (
            <div className="col-span-1 row-start-4 lg:col-start-4 lg:row-start-3">
              <CategoryHeroGridCard item={items[6]} />
            </div>
          )}

          {/* Item 7: Bottom Row 2 */}
          {items[7] && (
            <div className="col-span-1 row-start-4 lg:col-start-3 lg:row-start-3">
              <CategoryHeroGridCard item={items[7]} />
            </div>
          )}

          {/* Item 8: Bottom Row 3 */}
          {items[8] && (
            <div className="col-span-1 row-start-5 lg:col-start-2 lg:row-start-3">
              <CategoryHeroGridCard item={items[8]} />
            </div>
          )}

          {/* Item 9: Bottom Row 4 (Leftmost in RTL) */}
          {items[9] && (
            <div className="col-span-1 row-start-5 lg:col-start-1 lg:row-start-3">
              <CategoryHeroGridCard item={items[9]} />
            </div>
          )}
        </div>
      </div>
    );
  }

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
