'use client';

import { useState } from 'react';

import { NewsListItem } from '@/components/feed/news-list-item';
import type { FeedItem } from '@/lib/feed';

// تبويبات أخبار الشريط الجانبيّ (client) — «آخر الأخبار» / «الأكثر شيوعًا». تبديل لحظيّ بلا جلب
// إضافيّ (القائمتان مُمرَّرتان خادميًّا). صفّ مُدمج: صورة مصغّرة + عنوان + تاريخ نسبيّ، رابط متراكب.
export function NewsTabs({ latest, popular }: { latest: FeedItem[]; popular: FeedItem[] }) {
  const [tab, setTab] = useState<'latest' | 'popular'>('latest');
  const items = tab === 'latest' ? latest : popular;

  const tabCls = (active: boolean) =>
    `flex-1 border-b-2 px-2 py-2.5 text-sm font-bold transition-colors ${
      active ? 'border-primary text-fg' : 'border-transparent text-muted hover:text-fg'
    }`;

  return (
    <div className="border border-border bg-surface">
      <div className="flex border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'latest'}
          onClick={() => setTab('latest')}
          className={tabCls(tab === 'latest')}
        >
          آخر الأخبار
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'popular'}
          onClick={() => setTab('popular')}
          className={tabCls(tab === 'popular')}
        >
          الأكثر شيوعًا
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted">لا يوجد محتوى بعد.</p>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <NewsListItem item={item} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
