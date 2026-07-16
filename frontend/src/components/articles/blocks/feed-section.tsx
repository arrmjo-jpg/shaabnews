import type { FeedItem } from '@/lib/feed';
import { ArticleCard } from '@/components/articles/article-card';

// قسم شبكيّ لعرض مواد ذات صلة (يُعاد استخدامه لـ«اقرأ أيضًا» أسفل المقال). يستهلك `ArticleCard`
// و`FeedItem` الموجودين كما هما — صفر منطق بيانات جديد، عرض فقط.
interface FeedSectionProps {
  title: string;
  items: FeedItem[];
  id?: string;
}

export function FeedSection({ title, items, id }: FeedSectionProps) {
  if (items.length < 3) return null;

  return (
    <section className="mt-12 border-t border-border pt-8 print:hidden" aria-labelledby={id}>
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h2 id={id} className="text-lg font-extrabold text-fg border-r-4 border-primary pr-3 leading-none select-none sm:text-xl">
            {title}
          </h2>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ArticleCard key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}
