import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FeedCard } from '@/components/feed/feed-card';
import { Container } from '@/components/layout/container';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { Pagination } from '@/components/ui/pagination';
import { getCategoryBySlug, getCategoryPage } from '@/lib/feed';
import { buildMetadata } from '@/lib/seo';

// صفحة قسم /category/[slug] — قائمة مقالات القسم **مُرقَّمة** (شبكة FeedCard + ترقيم احترافيّ).
// تعيد استخدام getCategoryPage (filter[category] + page) + getCategoryBySlug لحلّ الاسم والتحقّق.
// قسم مجهول بلا مقالات ⇒ notFound (لا soft-404). تعتمد ?page= (ديناميكيّة)؛ بيانات القسم مُكاشة
// داخل الجالب (ISR 300s + tag category:{slug}؛ التحديث حدثيّ عند كلّ كتابة مقال في القسم).
export const revalidate = 21600;

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

  const [category, result] = await Promise.all([
    getCategoryBySlug(decoded),
    getCategoryPage(decoded, page, PER_PAGE),
  ]);
  const name = category?.name ?? result.items[0]?.category ?? null;
  if (!name) notFound();

  // slug من params مُرمَّز أصلاً ⇒ نرمّز **decoded** (العربيّة الفعليّة) مرّةً واحدةً (لا ترميز مزدوج).
  const hrefFor = (p: number) => `/category/${encodeURIComponent(decoded)}${p > 1 ? `?page=${p}` : ''}`;

  return (
    <Container className="py-8 sm:py-10">
      {/* ترويسة الصفحة: شارة حمراء عموديّة + اسم القسم */}
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <span className="h-8 w-1 shrink-0 bg-primary" style={{ borderRadius: '9999px' }} aria-hidden />
        <h1 className="font-heading text-2xl font-extrabold text-fg sm:text-3xl">{name}</h1>
      </div>

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
            <>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((item) => (
                  <li key={item.id}>
                    <FeedCard item={item} />
                  </li>
                ))}
              </ul>
              <Pagination currentPage={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
            </>
          )}
        </main>
        <aside className="hidden lg:col-span-4 lg:block">
          <ReadingSidebar />
        </aside>
      </div>
    </Container>
  );
}
