import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { ArticleCard } from '@/components/articles/article-card';
import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';

// قسمان متجاوران (مرجع المستخدم) — صفّ `lg:grid-cols-2` فيه بطاقتان مدمجتان، كلّ بطاقة: ترويسة + مقالان
// مميّزان (صورة 16:9 + عنوان) + ٦ عناصر مصغّرة (عنوان يمين + مصغّرة 74×52 يسار). **التصنيف بالـID الثابت**،
// Server Component، ISR 300s، خطّ الموقع، تصميم مربّع، `text-primary`. لا مقالات ⇒ تُخفى البطاقة (عزل فشل).

interface CardConfig {
  categoryId: number;
  headingId: string;
  fallbackTitle?: string;
}

export function CompactPairSection({ left, right }: { left: CardConfig; right: CardConfig }) {
  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl">
      <Container className="py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <CompactCategoryCard {...left} />
          <CompactCategoryCard {...right} />
        </div>
      </Container>
    </section>
  );
}

async function CompactCategoryCard({ categoryId, headingId, fallbackTitle }: CardConfig) {
  const category = await getCategoryById(categoryId);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 8);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  const features = items.slice(0, 2);
  const list = items.slice(2, 8);

  return (
    <article className="flex h-full flex-col border border-border bg-white p-3 md:p-4" aria-labelledby={headingId}>
      {/* الترويسة */}
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-2">
        <h3 id={headingId} className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight md:text-2xl">
          <span className="h-7 w-1.5 shrink-0 bg-primary" aria-hidden />
          <Link href={moreHref} className="text-fg transition-colors hover:text-primary">
            {title}
          </Link>
        </h3>
        <Link href={moreHref} className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted transition-colors hover:text-primary">
          عرض الكل
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </div>

      {/* مقالان مميّزان — متراكمان عموديّاً (صورة كبيرة فوق الأخرى) بطلب المستخدم، لا جنباً إلى جنب */}
      {features.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-4">
          {features.map((item) => (
            <ArticleCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* ٦ عناصر مصغّرة */}
      {list.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {list.map((item) => (
            <ItemMini key={item.id} item={item} />
          ))}
        </div>
      )}
    </article>
  );
}

// (بطاقة المقال المميّزة انتقلت إلى components/articles/article-card.tsx — مصدر واحد مُعاد الاستخدام.)

// عنصر مصغّر — العنوان يمين (أوّل DOM ⇒ يمين RTL) + مصغّرة 74×52 يسار. رابط متراكب يغطّي الصفّ.
function ItemMini({ item }: { item: FeedItem }) {
  return (
    <div className="group relative">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />
      <div className="flex items-start gap-2 p-1 transition-colors hover:bg-surface-2">
        <p className="line-clamp-2 flex-1 text-[13px] font-bold leading-snug text-fg transition-colors group-hover:text-primary">
          {item.title}
        </p>
        <div className="h-[52px] w-[74px] shrink-0 overflow-hidden bg-surface-2">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
            <img
              src={item.image}
              alt={item.imageAlt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="size-full bg-surface-3" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}
