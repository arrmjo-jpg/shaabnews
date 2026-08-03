import React from 'react';
import { formatRelativeTime } from '@/lib/format';
import { FontSizeControls } from './font-size-controls';

// سطر معلومات المقال: تاريخ نسبي + تاريخ مطلق + وقت القراءة (يمينًا) + أدوات حجم الخط (يسارًا).
// مكوّن عرض بحت — لا اتصال شبكي؛ يستقبل قيمًا جاهزة من ArticleDetail المحوَّل مسبقًا في lib/articles.ts.
interface MetadataRowProps {
  publishedAt: string | null;
  readingTime: number;
  author: { id: number | null; name: string; isWriter: boolean } | null;
  /** يُمرَّر لإخفاء تحكّم حجم الخط هنا على الموبايل حين يُعاد وضعه أسفل الصورة بدلاً منه
   * (article-detail.tsx، مقالات الأخبار العادية فقط) — راجع FontSizeControls. */
  fontControlsClassName?: string;
}

export function ArticleMetadata({ publishedAt, readingTime, fontControlsClassName }: MetadataRowProps) {
  const formatFullDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';

    const datePart = new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    return `${datePart} | ${timePart}`;
  };

  const pubDateAbs = publishedAt ? formatFullDateTime(publishedAt) : null;
  const pubDateRel = publishedAt ? formatRelativeTime(publishedAt) : null;

  const getReadingTimeStr = (mins: number) => {
    if (mins === 1) return 'دقيقة واحدة';
    if (mins === 2) return 'دقيقتان';
    if (mins >= 3 && mins <= 10) return `${mins} دقائق قراءة`;
    return `${mins} دقيقة قراءة`;
  };

  const metaItems: React.ReactNode[] = [];

  if (pubDateRel) {
    metaItems.push(
      <span key="pubDateRel" className="text-primary font-extrabold">
        {pubDateRel}
      </span>,
    );
  }

  if (pubDateAbs) {
    metaItems.push(
      <time key="pubDateAbs" dateTime={publishedAt ?? undefined} className="text-muted font-medium">
        {pubDateAbs}
      </time>,
    );
  }

  if (readingTime > 0) {
    metaItems.push(
      <span key="readingTime" className="text-muted font-medium">
        {getReadingTimeStr(readingTime)}
      </span>,
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3 my-2">
      <div className="font-sans text-xs sm:text-sm font-bold text-muted/80 tracking-wide flex flex-wrap items-center gap-1.5 border-r-4 border-primary/80 pr-3 py-1 editorial-meta">
        {metaItems.map((item, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span className="text-muted/40 px-2 font-normal select-none" aria-hidden>
                •
              </span>
            )}
            {item}
          </React.Fragment>
        ))}
      </div>

      <FontSizeControls className={fontControlsClassName} />
    </div>
  );
}
