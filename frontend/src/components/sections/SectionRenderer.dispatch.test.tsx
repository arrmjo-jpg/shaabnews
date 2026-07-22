import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/sections/renderers/FeaturedRenderer', () => ({
  FeaturedRenderer: vi.fn(() => <div data-testid="featured-renderer-called" />),
}));
vi.mock('@/components/sections/renderers/MagazineRenderer', () => ({
  MagazineRenderer: vi.fn(() => <div data-testid="magazine-renderer-called" />),
}));
vi.mock('@/components/sections/renderers/HeroRenderer', () => ({
  HeroRenderer: vi.fn(() => <div data-testid="hero-renderer-called" />),
}));

// يجب الاستيراد بعد vi.mock (hoisted تلقائيًّا بواسطة vitest، لكن الترتيب هنا للوضوح فقط).
import { SectionRenderer } from './SectionRenderer';
import { FeaturedRenderer } from '@/components/sections/renderers/FeaturedRenderer';
import { MagazineRenderer } from '@/components/sections/renderers/MagazineRenderer';
import { HeroRenderer } from '@/components/sections/renderers/HeroRenderer';
import type { CategoryRef, FeedItem } from '@/lib/feed';

const items: FeedItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `خبر ${i + 1}`,
  excerpt: null,
  href: `/news/${i + 1}`,
  image: null,
  imageAlt: '',
  category: null,
  categoryHref: null,
  author: null,
  publishedAt: null,
  badge: null,
}));

function makeCategory(layout: 'default' | 'hero' | 'magazine' | 'featured'): CategoryRef {
  return {
    id: 1,
    name: 'قسم',
    slug: 'section',
    href: '/category/section',
    appearance: {
      layout,
      show_title: true,
      banner: { url: null, height: 'md', overlay: true, position: 'center' },
      border: { enabled: false, width: 2, radius: 0, color: '#E5E7EB' },
    },
  };
}

describe('SectionRenderer dispatch — single dispatch point, per layout (Renderer Consolidation)', () => {
  it('invokes FeaturedRenderer exactly once and nothing else when layout is "featured"', () => {
    vi.clearAllMocks();
    renderToStaticMarkup(
      <SectionRenderer category={makeCategory('featured')} items={items} page={1}>
        {() => null}
      </SectionRenderer>,
    );

    expect(FeaturedRenderer).toHaveBeenCalledTimes(1);
    expect(MagazineRenderer).not.toHaveBeenCalled();
    expect(HeroRenderer).not.toHaveBeenCalled();
  });

  it('invokes MagazineRenderer exactly once and nothing else when layout is "magazine"', () => {
    vi.clearAllMocks();
    renderToStaticMarkup(
      <SectionRenderer category={makeCategory('magazine')} items={items} page={1}>
        {() => null}
      </SectionRenderer>,
    );

    expect(MagazineRenderer).toHaveBeenCalledTimes(1);
    expect(FeaturedRenderer).not.toHaveBeenCalled();
    expect(HeroRenderer).not.toHaveBeenCalled();
  });

  it('invokes HeroRenderer exactly once and nothing else when layout is "hero"', () => {
    vi.clearAllMocks();
    renderToStaticMarkup(
      <SectionRenderer category={makeCategory('hero')} items={items} page={1}>
        {() => null}
      </SectionRenderer>,
    );

    expect(HeroRenderer).toHaveBeenCalledTimes(1);
    expect(FeaturedRenderer).not.toHaveBeenCalled();
    expect(MagazineRenderer).not.toHaveBeenCalled();
  });

  it('invokes no renderer when layout is "default" (unreachable branch, see B2.4 plan)', () => {
    vi.clearAllMocks();
    renderToStaticMarkup(
      <SectionRenderer category={makeCategory('default')} items={items} page={1}>
        {() => null}
      </SectionRenderer>,
    );

    expect(FeaturedRenderer).not.toHaveBeenCalled();
    expect(MagazineRenderer).not.toHaveBeenCalled();
    expect(HeroRenderer).not.toHaveBeenCalled();
  });

  it('invokes no renderer on page 2, even for a live layout (featured only shows on page 1)', () => {
    vi.clearAllMocks();
    renderToStaticMarkup(
      <SectionRenderer category={makeCategory('featured')} items={items} page={2}>
        {() => null}
      </SectionRenderer>,
    );

    expect(FeaturedRenderer).not.toHaveBeenCalled();
    expect(MagazineRenderer).not.toHaveBeenCalled();
    expect(HeroRenderer).not.toHaveBeenCalled();
  });
});
