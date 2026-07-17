import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AdZone } from '@/components/ads/ad-zone';
import { CategoryFeaturedGrid } from '@/components/category/category-featured-grid';
import { CategoryLoadMoreFeed } from '@/components/category/category-load-more-feed';
import { Container } from '@/components/layout/container';
import { CategoryBreadcrumb } from '@/components/navigation/category-breadcrumb';
import { SubscribeBox } from '@/components/public-forms/subscribe-box';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { getCategoryAncestry, getCategoryBySlug, getCategoryFeaturedGrid, getCategoryPage } from '@/lib/feed';
import { buildMetadata } from '@/lib/seo';

// صفحة قسم /category/[slug] — القالب الأساسي الموحَّد لكل الأقسام: مسار تنقّل + شبكة "مميّزة"
// (is_featured) + إعلان فاصل + تغذية زمنية بزرّ "تحميل المزيد" + شريط جانبي (ودجت + إعلان +
// اشتراك واتساب). الواجهة (بانر/عنوان/حدّ) تبقى SectionRenderer دون تغيير — هذا القالب يضيف
// ما فوقه وتحته فقط. قسم مجهول بلا مقالات ⇒ notFound (لا soft-404). ?page= لا يزال يحدّد
// الدفعة الأولى SSR (رابط عميق يعمل)؛ "تحميل المزيد" يكمل من هناك فصاعداً عبر BFF.
// ISR = سقف أمان فقط (36000)؛ التحديث الفعليّ حدثيّ عبر category:{slug}/articles.
export const revalidate = 36000;

const FEATURED_LIMIT = 9;

const PER_PAGE = 18;

async function resolveName(decoded: string): Promise<string | null> {
  const category = await getCategoryBySlug(decoded);
  if (category) {
    return category.name;
  }
  // قسم خارج شجرة /categories لكنّه يملك مقالات: الاسم من أوّل مقال.
  const first = await getCategoryPage(decoded, 1, 1);

  return first.items[0]?.category ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const name = await resolveName(decoded);
  if (!name) return { title: 'القسم غير موجود', robots: { index: false, follow: false } };

  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);
  const path = `/category/${encodeURIComponent(decoded)}${page > 1 ? `?page=${page}` : ''}`;

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
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(slug);
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);

  const [category, result, featured, ancestry] = await Promise.all([
    getCategoryBySlug(decoded),
    getCategoryPage(decoded, page, PER_PAGE),
    getCategoryFeaturedGrid(decoded, FEATURED_LIMIT),
    getCategoryAncestry(decoded),
  ]);
  const name = category?.name ?? result.items[0]?.category ?? null;
  if (!name) notFound();

  return (
    <Container className="py-8 sm:py-10">
      <CategoryBreadcrumb chain={ancestry} name={name} />
      <SectionRenderer category={category} name={name}>
        <CategoryFeaturedGrid items={featured} />
        <AdZone zone="aalan_fasl_alaqsam_b" className="mb-6" />

        {/* نفس شبكة المقال: محتوى 8 + ودجت الأخبار في الجانب الأيسر (4 أعمدة). */}
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
                slug={decoded}
                initialItems={result.items}
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
      </SectionRenderer>
    </Container>
  );
}
