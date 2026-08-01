import type { Metadata } from 'next';

import { ArticleCard } from '@/components/articles/article-card';
import { Container } from '@/components/layout/container';
import { SearchIcon } from '@/components/icons';
import { Pagination } from '@/components/ui/pagination';
import { searchArticles } from '@/lib/search';

// صفحة نتائج بحث الأخبار — تقرأ `?q=` (يرسلها نموذج بحث الهيدر) وتستدعي مرشّح `filter[q]`
// (Scout/Meilisearch بالباك إند) عبر searchArticles. تعيد استخدام ArticleCard + view-model الموحَّد.
// noindex (صفحات نتائج البحث لا تُفهرَس). ديناميكيّة (تعتمد searchParams) — لا ISR ثابت.
// نُقِلت إلى /news/search (2026-07-18)؛ /search القديم يُعيد التوجيه 301 عبر next.config.ts.
export const metadata: Metadata = {
  title: 'بحث',
  robots: { index: false, follow: true },
};

const PER_PAGE = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : '').trim();
  const page = Math.max(1, Number(typeof sp.page === 'string' ? sp.page : '1') || 1);

  const result = q
    ? await searchArticles(q, page, 'ar', PER_PAGE)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const linkTo = (p: number) => `/news/search?q=${encodeURIComponent(q)}&page=${p}`;

  return (
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-extrabold text-fg">البحث في الأخبار</h1>

      {/* نموذج بحث داخل الصفحة (تنقيح/إعادة بحث) — GET إلى /news/search؛ مبدئيّ بالكلمة الحاليّة. */}
      <form action="/news/search" method="get" role="search" className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-lg bg-surface-2 px-4">
          <SearchIcon className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="ابحث في الأخبار…"
            className="h-12 w-full bg-transparent text-base text-fg outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90"
        >
          بحث
        </button>
      </form>

      {q ? (
        <p className="mb-6 text-sm text-muted">
          {result.total > 0
            ? `${result.total.toLocaleString('ar-EG')} نتيجة لـ «${q}»`
            : `لا نتائج لـ «${q}»`}
        </p>
      ) : (
        <p className="mb-6 text-sm text-muted">اكتب كلمةً في الحقل أعلاه للبحث في الأخبار.</p>
      )}

      {result.items.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((it) => (
              <ArticleCard key={it.href} item={it} />
            ))}
          </div>

          <Pagination currentPage={page} totalPages={result.totalPages} hrefFor={linkTo} />
        </>
      ) : q ? (
        <div className="py-16 text-center text-muted">
          <p className="text-lg font-bold text-fg">لا نتائج مطابقة</p>
          <p className="mt-1 text-sm">جرّب كلماتٍ أخرى أو تأكّد من الإملاء.</p>
        </div>
      ) : null}
    </Container>
  );
}
