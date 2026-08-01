import { FileText, PenLine } from 'lucide-react';

import { ShareButtons } from '@/components/share/share-buttons';
import { socialEntries } from '@/components/layout/social-map';
import { formatNumber } from '@/lib/format';
import type { WriterProfile } from '@/lib/writer';

// رأس بروفيل الكاتب — مبنيّ من الصفر (غير مشتقّ من CategoryDefaultHeader؛ راجع
// docs/roadmap/AUTHOR-PROFILE-PAGE-ANALYSIS.md §4: التصميمان لا يتشاركان أي إعداد appearance
// حقيقيّ). صورة + اسم + شارة «كاتب» + عدد المقالات (الآن معبَّأ فعليًّا، انظر §3 إصلاح المرحلة 1) +
// أيقونات تواصل مُعلَّمة (socialEntries، بدل نصّ المفتاح الخام السابق) + مشاركة + نبذة.
export function WriterProfileHeader({ writer, shareUrl }: { writer: WriterProfile; shareUrl: string }) {
  const socials = socialEntries(writer.social);

  return (
    <div className="border-b border-border bg-surface-2/40">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8" dir="rtl">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-start">
          <div
            className="size-28 shrink-0 overflow-hidden bg-surface-2 ring-2 ring-border sm:size-32"
            style={{ borderRadius: '9999px' }}
          >
            {writer.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود
              <img src={writer.avatar} alt={writer.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-surface-3 text-muted" aria-hidden>
                <PenLine className="size-10" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <PenLine className="size-3.5" aria-hidden />
              كاتب
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-fg sm:text-3xl">{writer.name}</h1>

            <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted">
              <FileText className="size-4 shrink-0" aria-hidden />
              {formatNumber(writer.articlesCount)} مقال
            </span>

            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {socials.map(({ key, url, Icon, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={label}
                    title={label}
                    className="inline-flex size-9 items-center justify-center bg-surface-2 text-fg transition-colors hover:bg-surface-3 hover:text-primary"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-center sm:justify-start">
              <ShareButtons url={shareUrl} title={writer.name} />
            </div>
          </div>
        </div>

        {writer.bio && (
          <p className="mt-6 whitespace-pre-line text-center leading-relaxed text-fg sm:text-start">{writer.bio}</p>
        )}
      </div>
    </div>
  );
}
