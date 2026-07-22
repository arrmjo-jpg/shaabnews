'use client';

import { useState } from 'react';

import { NewsListItem } from '@/components/feed/news-list-item';
import { Button } from '@/components/ui/button';
import type { CategoryPageResult, FeedItem } from '@/lib/feed';

// تغذية القسم الزمنية بزرّ "تحميل المزيد" بدل الترقيم المرقّم — صفّ مُدمج (NewsListItem: صورة
// مصغّرة + عنوان) بدل شبكة كروت كبيرة، مطابقةً لتصميم صفحة القسم المرجعيّ. الدفعة الأولى SSR (من
// getCategoryPage في الصفحة، تحافظ على ?page= كرابط عميق: يُهيّأ initialPage من searchParams
// كما هو، والزرّ يكمل من هناك فصاعداً)، وكل دفعة تالية طلب شبكة حقيقي عبر BFF
// /api/category/[slug] (نفس getCategoryPage خادميّاً) — لا نجلب كل مقالات القسم دفعة واحدة
// (قد تبلغ عشرات الآلاف).
export function CategoryLoadMoreFeed({
  slug,
  initialItems,
  initialPage,
  initialTotalPages,
}: {
  slug: string;
  initialItems: FeedItem[];
  initialPage: number;
  initialTotalPages: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || page >= totalPages) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/category/${encodeURIComponent(slug)}?page=${page + 1}`);
      if (res.ok) {
        const next: CategoryPageResult = await res.json();
        setItems((prev) => [...prev, ...next.items]);
        setPage(next.page);
        setTotalPages(next.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {items.map((item, index) => {
          const isFirst = index === 0;
          return (
            <li
              key={item.id}
              className="group relative border border-border bg-surface transition-all duration-300 hover:border-primary/20 hover:shadow-sm"
            >
              <NewsListItem item={item} variant="feed" isFirst={isFirst} />
            </li>
          );
        })}
      </ul>

      {page < totalPages && (
        <div className="mt-10 flex justify-center">
          <Button onClick={() => void loadMore()} disabled={loading} aria-busy={loading} variant="outline" size="lg">
            {loading ? 'جارٍ التحميل…' : 'تحميل المزيد'}
          </Button>
        </div>
      )}
    </>
  );
}
