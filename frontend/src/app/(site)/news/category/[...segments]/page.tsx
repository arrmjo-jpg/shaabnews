import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { AdZone } from '@/components/ads/ad-zone';
import { CategoryLoadMoreFeed } from '@/components/category/category-load-more-feed';
import { Container } from '@/components/layout/container';
import { CategoryBreadcrumb } from '@/components/navigation/category-breadcrumb';
import { SubscribeBox } from '@/components/public-forms/subscribe-box';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import {
  categoryHref,
  getCategoryAncestry,
  getCategoryBySlug,
  getCategoryPage,
  CategoryRef,
} from '@/lib/feed';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 36000;

const PER_PAGE = 18;

function CategoryDefaultHeader({ category, name }: { category: CategoryRef | null; name: string }) {
  const appearance = category?.appearance;
  const showTitle = appearance?.show_title ?? true;

  if (!showTitle) {
    return <h1 className="sr-only">{name}</h1>;
  }

  const bannerUrl = appearance?.banner?.url;
  const hasBanner = !!bannerUrl;
  const description = category?.description;

  return (
    <div
      className={`relative w-full flex flex-col items-center justify-center text-center overflow-hidden ${
        hasBanner
          ? 'px-6 text-white'
          : 'bg-transparent px-6'
      }`}
      style={{
        paddingBlock: 'calc(var(--spacing) * 9)',
        maxHeight: '140px',
      }}
    >
      {hasBanner && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          {appearance.banner.overlay && (
            <div
              className="pointer-events-none absolute inset-0 bg-black/50"
              aria-hidden
            />
          )}
        </>
      )}

      {/* Header Content Wrapper */}
      <div className="relative z-10 flex flex-col items-center max-w-3xl px-4">
        <h1 className={`font-heading font-black relative z-20 text-[2rem] lg:text-[3.125rem] leading-[1.3] ${hasBanner ? 'text-white' : 'text-fg'}`}>
          {name}
        </h1>
        {description && (
          <p className={`line-clamp-1 text-xs max-w-xl mt-2 leading-relaxed ${hasBanner ? 'text-white/80' : 'text-muted'}`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

type RouteParams = { segments: string[] };
type SearchParamsShape = { page?: string | string[] };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParamsShape>;
}): Promise<Metadata> {
  const { segments } = await params;
  const leafSlug = decodeURIComponent(segments[segments.length - 1] ?? '');
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);
  
  const [category, result] = await Promise.all([
    getCategoryBySlug(leafSlug),
    getCategoryPage(leafSlug, page, PER_PAGE),
  ]);
  const name = category?.name ?? result.items[0]?.category ?? null;
  if (!name) return { title: 'القسم غير موجود', robots: { index: false, follow: false } };

  const ancestry = await getCategoryAncestry(leafSlug);
  const path = (ancestry && ancestry.length > 0 ? categoryHref(ancestry) : `/news/category/${encodeURIComponent(leafSlug)}`)
    + (page > 1 ? `?page=${page}` : '');

  return buildMetadata({
    title: name,
    description: `أحدث الأخبار والمقالات في قسم ${name}`,
    path,
    type: 'website',
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParamsShape>;
}) {
  const { segments } = await params;
  if (segments.length === 0 || segments.length > 3) notFound();

  const decodedSegments = segments.map((s) => decodeURIComponent(s));
  const leafSlug = decodedSegments[decodedSegments.length - 1];
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);

  const [category, result, ancestry] = await Promise.all([
    getCategoryBySlug(leafSlug),
    getCategoryPage(leafSlug, page, PER_PAGE),
    getCategoryAncestry(leafSlug),
  ]);
  const name = category?.name ?? result.items[0]?.category ?? null;
  if (!name) notFound();

  if (ancestry && ancestry.length > 0) {
    const trueSlugs = ancestry.map((a) => a.slug);
    const matches = trueSlugs.length === decodedSegments.length
      && trueSlugs.every((s, i) => s === decodedSegments[i]);
    if (!matches) {
      permanentRedirect(categoryHref(ancestry) + (page > 1 ? `?page=${page}` : ''));
    }
  }

  const breadcrumb = <CategoryBreadcrumb chain={ancestry} name={name} />;

  return (
    <div className="w-full">
      <CategoryDefaultHeader category={category} name={name} />

      <Container className="py-8 sm:py-10">
        {breadcrumb}

        <SectionRenderer category={category} items={result.items} page={page}>
          {({ feedItems }) => (
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
              <main className="min-w-0 lg:col-span-8">
                {result.total === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
                    style={{ borderRadius: '12px' }}
                  >
                    <h2 className="font-heading text-h3 font-bold text-fg">لا توجد مقالات في هذا القسم بعد</h2>
                    <p className="max-w-md text-sm text-muted">ستظهر هنا مقالات «{name}» فور نشرها.</p>
                  </div>
                ) : (
                  <CategoryLoadMoreFeed
                    slug={leafSlug}
                    initialItems={feedItems}
                    initialPage={result.page}
                    initialTotalPages={result.totalPages}
                  />
                )}
              </main>
              <aside className="hidden lg:col-span-4 lg:block space-y-6">
                <ReadingSidebar />
                <AdZone zone="aalan_ala_shmal_alaqsam" />
                <SubscribeBox variant="card" />
              </aside>
            </div>
          )}
        </SectionRenderer>
      </Container>
    </div>
  );
}
