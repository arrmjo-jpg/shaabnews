import Link from 'next/link';
import { env } from '@/lib/env';

// مسار تنقّل المقال (Breadcrumb) + JSON-LD (BreadcrumbList). رابط التصنيف: مسار مفرد
// `/news/category/{slug}` (بلا سلسلة أسلاف — هذا المكوّن لا يملك إلا slug القسم الأساسيّ
// للمقال، لا سلسلته الكاملة). يطابق item.href في JSON-LD أدناه؛ إن كان القسم متداخلاً
// فعلياً، /news/category/{slug} يُعيد توجيه 301 لمساره الكامل (لا كسر، مجرّد قفزة إضافية).
interface BreadcrumbProps {
  category: { name: string; slug: string } | null;
  title: string;
  articleUrl: string;
}

export function ArticleBreadcrumb({ category, title, articleUrl }: BreadcrumbProps) {
  const siteUrl = env.siteUrl || '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'الرئيسية',
        item: siteUrl || '/',
      },
      ...(category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: category.name,
              item: `${siteUrl}/news/category/${encodeURIComponent(category.slug)}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: category ? 3 : 2,
        name: title,
        item: `${siteUrl}${articleUrl}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="مسار التنقّل" className="mb-1 flex flex-wrap items-center text-xs text-muted sm:text-sm print:hidden">
        <ol itemScope itemType="https://schema.org/BreadcrumbList" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center">
            <Link itemProp="item" href="/" className="transition-colors hover:text-primary font-medium">
              <span itemProp="name">الرئيسية</span>
            </Link>
            <meta itemProp="position" content="1" />
          </li>

          {category && (
            <>
              <span aria-hidden className="text-muted/60 select-none">
                /
              </span>
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center">
                <Link
                  itemProp="item"
                  href={`/news/category/${encodeURIComponent(category.slug)}`}
                  className="transition-colors hover:text-primary font-medium"
                >
                  <span itemProp="name">{category.name}</span>
                </Link>
                <meta itemProp="position" content="2" />
              </li>
            </>
          )}

          <span aria-hidden className="text-muted/60 select-none">
            /
          </span>
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center">
            <span itemProp="name" className="line-clamp-1 text-fg font-semibold">
              {title}
            </span>
            <meta itemProp="position" content={category ? '3' : '2'} />
          </li>
        </ol>
      </nav>
    </>
  );
}
