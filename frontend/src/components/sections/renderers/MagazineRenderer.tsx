import Link from 'next/link';

import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// شبكة "مجلّة" (magazine) — 9 عناصر بثلاث درجات بصريّة. مُستخرَجة حرفيًّا (copy-move) من فرع
// layout==='magazine' السابق داخل CategoryFeaturedGrid (Renderer Consolidation، B2.2) — لا تغيير
// بصريّ، نفس الأصناف/البنية تمامًا. مُستدعاة الآن مباشرةً من SectionRenderer بدل المرور عبر
// CategoryFeaturedGrid.
export function MagazineRenderer({ items }: { items: FeedItem[] }) {
  return (
    <div className="mb-8">
      <ul className="themed-featured-posts-list themed-featured-posts-list--featured-9-regular">
        {items.slice(0, 9).map((item, index) => {
          if (index === 0) {
            return (
              <li key={item.id} className="themed-featured-posts-list__item">
                <article className="article-card--reset article-card--highlighted">
                  {item.image && (
                    <div className="article-card__image-wrap article-card__featured-image">
                      <div className="responsive-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="article-card__image" loading="eager" src={item.image} alt={item.imageAlt} />
                      </div>
                    </div>
                  )}
                  <div className="article-card__content-wrap article-card__content-wrap--end-image">
                    <Link className="u-clickable-card__link article-card__link" href={item.href}>
                      <h2 className="article-card__title">
                        <span>{item.title}</span>
                      </h2>
                    </Link>
                    {item.excerpt && (
                      <p className="article-card__excerpt">
                        <span>{item.excerpt}</span>
                      </p>
                    )}
                  </div>
                  {item.publishedAt && (
                    <footer className="article-card__footer u-clickable-card__exclude mt-auto pt-2">
                      <div className="gc__date gc__date--published">
                        <div className="gc__date__date">
                          <div className="date-simple text-xs text-muted">
                            <span aria-hidden="true">{formatRelativeTime(item.publishedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </footer>
                  )}
                </article>
              </li>
            );
          } else if (index === 1 || index === 2) {
            return (
              <li key={item.id} className="themed-featured-posts-list__item">
                <article className="article-card--reset desktop:article-card--stacked mobile:article-card--side-by-side">
                  {item.image && (
                    <div className="article-card__image-wrap article-card__featured-image">
                      <div className="responsive-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="article-card__image" loading="eager" src={item.image} alt={item.imageAlt} />
                      </div>
                    </div>
                  )}
                  <div className="article-card__content-wrap article-card__content-wrap--end-image">
                    <Link className="u-clickable-card__link article-card__link" href={item.href}>
                      <h2 className="article-card__title">
                        <span>{item.title}</span>
                      </h2>
                    </Link>
                  </div>
                  {item.publishedAt && (
                    <footer className="article-card__footer u-clickable-card__exclude mt-auto pt-2">
                      <div className="gc__date gc__date--published">
                        <div className="gc__date__date">
                          <div className="date-simple text-xs text-muted">
                            <span aria-hidden="true">{formatRelativeTime(item.publishedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </footer>
                  )}
                </article>
              </li>
            );
          } else {
            return (
              <li key={item.id} className="themed-featured-posts-list__item">
                <article className="article-card--reset article-card--side-by-side">
                  <div className="article-card__content-wrap article-card__content-wrap--end-image">
                    <Link className="u-clickable-card__link article-card__link" href={item.href}>
                      <h2 className="article-card__title">
                        <span>{item.title}</span>
                      </h2>
                    </Link>
                  </div>
                  {item.image && (
                    <div className="article-card__image-wrap article-card__featured-image">
                      <div className="responsive-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="article-card__image" loading="eager" src={item.image} alt={item.imageAlt} />
                      </div>
                    </div>
                  )}
                </article>
              </li>
            );
          }
        })}
      </ul>
    </div>
  );
}
