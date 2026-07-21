import Link from 'next/link';
import { env } from '@/lib/env';

// مسار تنقّل مشترك لصفحات الرياضة (فريق/لاعب/مباراة/بطولة) + JSON-LD (BreadcrumbList).
// نفس نمط `ArticleBreadcrumb` (microdata + JSON-LD معًا) لكن معمَّم لعدد عناصر عشوائي، لأنّ
// الصفحات الأربع تشترك بالضبط في نفس شكل السلسلة: الرئيسية ← الرياضة ← [تصنيف اختياري] ← الكيان الحالي.
export interface SportBreadcrumbItem {
  name: string;
  href?: string;
}

export function SportBreadcrumb({ items }: { items: SportBreadcrumbItem[] }) {
  const siteUrl = env.siteUrl || '';
  const all: SportBreadcrumbItem[] = [{ name: 'الرئيسية', href: '/' }, { name: 'الرياضة', href: '/sport' }, ...items];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${siteUrl}${it.href ?? ''}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="مسار التنقّل" className="mb-4 flex flex-wrap items-center text-xs font-bold text-muted sm:text-sm">
        <ol itemScope itemType="https://schema.org/BreadcrumbList" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {all.map((it, i) => {
            const isLast = i === all.length - 1;
            return (
              <li
                key={i}
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
                className="flex items-center gap-1.5 sm:gap-2"
              >
                {i > 0 && (
                  <span aria-hidden className="select-none text-muted/60">
                    /
                  </span>
                )}
                {isLast || !it.href ? (
                  <span itemProp="name" className="line-clamp-1 text-fg">
                    {it.name}
                  </span>
                ) : (
                  <Link itemProp="item" href={it.href} className="transition-colors hover:text-primary">
                    <span itemProp="name">{it.name}</span>
                  </Link>
                )}
                <meta itemProp="position" content={String(i + 1)} />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
