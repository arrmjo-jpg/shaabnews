import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import { FeaturedRenderer } from './FeaturedRenderer';
import type { FeedItem } from '@/lib/feed';

// نفس عناصر الاختبار المُستخدَمة لالتقاط __fixtures__/featured-renderer.snapshot.html — لا
// تُغيَّر هذه المصفوفة بلا تحديث الـsnapshot معها (راجع كيفية التقاطه في سجلّ B2.1).
const items: FeedItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `عنوان الخبر ${i + 1}`,
  excerpt: i % 2 === 0 ? `ملخّص الخبر ${i + 1}` : null,
  href: `/news/2026/07/22/${i + 1}`,
  image: i % 3 === 0 ? null : `https://cdn.example.com/img-${i + 1}.jpg`,
  imageAlt: `صورة ${i + 1}`,
  category: 'محليات',
  categoryHref: '/category/local',
  author: null,
  publishedAt: i % 2 === 0 ? '2026-07-22T10:00:00.000Z' : null,
  badge: null,
}));

describe('FeaturedRenderer — Renderer Consolidation (B2.1)', () => {
  it('matches the captured pre-extraction snapshot byte-for-byte', () => {
    const expected = fs.readFileSync(
      path.resolve(__dirname, '__fixtures__/featured-renderer.snapshot.html'),
      'utf-8',
    );
    const actual = renderToStaticMarkup(<FeaturedRenderer items={items} />);
    expect(actual).toBe(expected);
  });

  it('renders only the first 5 items even when given more', () => {
    const extra: FeedItem[] = [
      ...items,
      { ...items[0], id: 999, title: 'زائد عن الحدّ', href: '/news/999' },
    ];
    const html = renderToStaticMarkup(<FeaturedRenderer items={extra} />);
    expect(html).not.toContain('زائد عن الحدّ');
  });

  it('renders nothing extra for an empty list (no crash, empty <ul>)', () => {
    const html = renderToStaticMarkup(<FeaturedRenderer items={[]} />);
    expect(html).toContain('themed-featured-posts-list');
    expect(html).not.toContain('themed-featured-posts-list__item');
  });
});
