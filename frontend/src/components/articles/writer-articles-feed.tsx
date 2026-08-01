'use client';

import { useState } from 'react';

import { NewsListItem } from '@/components/feed/news-list-item';
import { Button } from '@/components/ui/button';
import type { FeedItem } from '@/lib/feed';
import type { WriterPageResult } from '@/lib/writer';

// تغذية مقالات الكاتب بزرّ "تحميل المزيد" — نفس نمط CategoryLoadMoreFeed تمامًا (صفّ NewsListItem
// variant="feed") لكن مفتاحه id الكاتب الرقميّ بدل سلَغ القسم، عبر BFF /api/writer/[id]/articles
// (getWriterArticles خادميًّا، لا استعلام جديد). الدفعة الأولى SSR من الصفحة نفسها.
export function WriterArticlesFeed({
  writerId,
  initialItems,
  initialPage,
  initialTotalPages,
}: {
  writerId: number;
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
      const res = await fetch(`/api/writer/${writerId}/articles?page=${page + 1}`);
      if (res.ok) {
        const next: WriterPageResult = await res.json();
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
