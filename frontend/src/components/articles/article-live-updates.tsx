'use client';

import { useEffect, useRef, useState } from 'react';

import type { ArticleImage, LiveUpdateItem } from '@/lib/articles';
import { formatRelativeTime } from '@/lib/format';

// عرض التغطية الحيّة (type=live) — يميّزه عن الخبر العاديّ. يبدأ بالخطّ الزمنيّ المُصيَّر خادميّاً (SSR/SEO) ثمّ
// يستطلع BFF كلّ 30 ثانية بـETag/304 (لا يجعل الصفحة ديناميكيّة، يعيد استخدام نظام live-updates المُصمَّم للـpolling).
export function ArticleLiveUpdates({ slug, initial }: { slug: string; initial: LiveUpdateItem[] }) {
  const [items, setItems] = useState<LiveUpdateItem[]>(initial);
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers['If-None-Match'] = etagRef.current;
        const res = await fetch(`/api/live-updates?slug=${encodeURIComponent(slug)}`, { headers });
        if (!active || res.status === 304) return;
        const et = res.headers.get('etag');
        if (et) etagRef.current = et;
        const json: unknown = await res.json().catch(() => null);
        const data = (json as { data?: unknown } | null)?.data;
        if (Array.isArray(data)) setItems(data.map(mapRaw));
      } catch {
        /* تجاهل خطأ استطلاع مؤقّت — المحاولة التالية بعد المهلة */
      }
    };
    const interval = window.setInterval(poll, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [slug]);

  if (items.length === 0) return null;

  return (
    <section aria-label="التغطية الحيّة" className="not-prose">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
          <span className="avatar size-2 animate-pulse bg-white" aria-hidden />
          مباشر
        </span>
        <span className="text-sm font-bold text-muted">{items.length} تحديث</span>
      </div>

      <ol className="space-y-5 border-s-2 border-border ps-5">
        {items.map((u) => (
          <li key={u.id} className="relative">
            <span className="avatar absolute -start-[27px] top-1.5 size-3 bg-primary" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
              {u.isPinned && <span className="bg-surface-2 px-1.5 py-0.5 font-bold text-fg">مثبّت</span>}
              {u.isBreaking && <span className="bg-primary px-1.5 py-0.5 font-bold text-primary-foreground">عاجل</span>}
              {u.happenedAt && <time dateTime={u.happenedAt}>{formatRelativeTime(u.happenedAt)}</time>}
            </div>
            {u.title && <h3 className="mt-1 text-base font-bold text-fg">{u.title}</h3>}
            {u.contentHtml && (
              <div className="tiptap-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.contentHtml }} />
            )}
            {u.gallery.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {u.gallery.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود (سياسة صور الواجهة)
                  <img key={i} src={g.medium ?? g.url} alt={g.alt ?? ''} loading="lazy" decoding="async" className="w-full object-cover" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

// محوّل عرض client (يثق بشكل الـBFF = شكل الـAPI) — يطابق mapLiveUpdate الخادميّ؛ عرض لا منطق أعمال.
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function mapRaw(raw: unknown): LiveUpdateItem {
  const u = (raw ?? {}) as Record<string, unknown>;
  const media = (u.media ?? {}) as Record<string, unknown>;
  const author = (u.author ?? {}) as Record<string, unknown>;
  const gallery = Array.isArray(media.gallery) ? media.gallery : [];
  return {
    id: typeof u.id === 'number' ? u.id : 0,
    title: str(u.title),
    contentHtml: typeof u.content_html === 'string' ? u.content_html : '',
    isPinned: u.is_pinned === true,
    isBreaking: u.is_breaking === true,
    happenedAt: str(u.happened_at),
    authorName: str(author.name),
    gallery: gallery
      .map((g): ArticleImage | null => {
        const gi = (g ?? {}) as Record<string, unknown>;
        const url = str(gi.url);
        return url
          ? { url, thumb: str(gi.thumb), medium: str(gi.medium), alt: str(gi.alt), caption: str(gi.caption) }
          : null;
      })
      .filter((g): g is ArticleImage => g !== null),
  };
}
