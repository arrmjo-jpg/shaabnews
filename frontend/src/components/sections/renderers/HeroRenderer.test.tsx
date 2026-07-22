import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

import { HeroRenderer } from './HeroRenderer';
import type { CategoryRef, FeedItem } from '@/lib/feed';

// الساعة مُجمَّدة (7 ساعات بعد publishedAt أدناه) لأنّ formatRelativeTime تحسب الفرق من
// Date.now() الحقيقيّ — بلا تجميد، نصّ "قبل N ساعات" يتغيّر مع مرور الوقت الفعليّ ويكسر
// مقارنة الـsnapshot لاحقًا (بالضبط ما حدث لـFeaturedRenderer/MagazineRenderer، غير مُصلَح
// هنا عمدًا — متابَع كمهمّة منفصلة، لا جزءًا من B2.3a).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-22T17:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

// نفس عناصر الاختبار المُستخدَمة لالتقاط __fixtures__/hero-renderer.snapshot.html — لا تُغيَّر
// هذه المصفوفة أو فئة القسم بلا تحديث الـsnapshot معها (راجع كيفية التقاطه في سجلّ B2.3a).
const items: FeedItem[] = Array.from({ length: 10 }, (_, i) => ({
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

const category: CategoryRef = {
  id: 1,
  name: 'قسم',
  slug: 'section',
  href: '/category/section',
  appearance: {
    layout: 'hero',
    show_title: true,
    banner: { url: null, height: 'md', overlay: true, position: 'center' },
    border: { enabled: true, width: 2, radius: 0, color: '#A80101' },
  },
};

describe('HeroRenderer — Renderer Consolidation (B2.3a)', () => {
  it('matches the captured pre-extraction snapshot byte-for-byte', () => {
    const expected = fs.readFileSync(
      path.resolve(__dirname, '__fixtures__/hero-renderer.snapshot.html'),
      'utf-8',
    );
    const actual = renderToStaticMarkup(<HeroRenderer items={items} category={category} />);
    expect(actual).toBe(expected);
  });

  it('passes category.appearance.border.color through to the mega post card style', () => {
    const html = renderToStaticMarkup(<HeroRenderer items={items} category={category} />);
    expect(html).toContain('#A80101');
  });

  it('falls back to var(--primary) when no category (or no border color) is given', () => {
    const html = renderToStaticMarkup(<HeroRenderer items={items} category={null} />);
    expect(html).toContain('var(--primary)');
    expect(html).not.toContain('#A80101');
  });

  it('renders only items 0-9 even when given more', () => {
    const extra: FeedItem[] = [
      ...items,
      { ...items[0], id: 999, title: 'زائد عن الحدّ', href: '/news/999' },
    ];
    const html = renderToStaticMarkup(<HeroRenderer items={extra} category={category} />);
    expect(html).not.toContain('زائد عن الحدّ');
  });
});
