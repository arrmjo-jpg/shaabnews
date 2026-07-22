import Link from 'next/link';

import { env } from '@/lib/env';
import { categoryHref, type CategoryAncestor } from '@/lib/feed';

// مسار تنقّل صفحة القسم (N مستويات: الرئيسية / جذر / .../ القسم الحالي) + JSON-LD
// (BreadcrumbList). نفس نمط ArticleBreadcrumb (articles/blocks/breadcrumb.tsx) — بُنية
// nav/ol/microdata وفواصل "/" — لكن مكوّن مستقلّ: عقد ArticleBreadcrumb (category واحد +
// title) خاصّ بصفحة المقال، وتمديده لسلسلة عشوائية الطول يخاطر بصفحة المقال المنشورة أصلاً
// مقابل فائدة DRY هامشية.
//
// chain=null (قسم خارج شجرة /categories له مقالات لكن غير مصنَّف فيها) ⇒ مسار مستوى واحد
// (الرئيسية / name) بدل حذف الشريط بالكامل — عناصر التنقّل تبقى ظاهرة دائماً.
export function CategoryBreadcrumb({ chain, name }: { chain: CategoryAncestor[] | null; name: string }) {
  const siteUrl = env.siteUrl || '';
  const crumbs = chain && chain.length > 0 ? chain : [{ id: 0, name, slug: '' }];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: siteUrl || '/' },
      // مسار متداخل تراكميّ (2026-07-18): كل مستوى يرث سلاسل أسلافه، لا سلَغه المفرد فقط —
      // مطابقة Category::canonicalPath() (الباك إند).
      ...crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.name,
        item: c.slug ? `${siteUrl}${categoryHref(crumbs.slice(0, i + 1))}` : `${siteUrl}/news/category/${encodeURIComponent(name)}`,
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="مسار التنقّل" className="mb-4 flex flex-wrap items-center text-xs text-muted sm:text-sm print:hidden">
        <ol itemScope itemType="https://schema.org/BreadcrumbList" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center">
            <Link itemProp="item" href="/" className="transition-colors hover:text-primary font-medium">
              <span itemProp="name">الرئيسية</span>
            </Link>
            <meta itemProp="position" content="1" />
          </li>

          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const href = c.slug ? categoryHref(crumbs.slice(0, i + 1)) : `/news/category/${encodeURIComponent(name)}`;

            return (
              <span key={c.slug || c.id} className="flex items-center gap-1.5 sm:gap-2">
                <span aria-hidden className="text-muted/60 select-none">
                  /
                </span>
                <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center">
                  {isLast ? (
                    <span itemProp="name" className="line-clamp-1 text-fg font-semibold">
                      {c.name}
                    </span>
                  ) : (
                    <Link itemProp="item" href={href} className="transition-colors hover:text-primary font-medium">
                      <span itemProp="name">{c.name}</span>
                    </Link>
                  )}
                  <meta itemProp="position" content={String(i + 2)} />
                </li>
              </span>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
