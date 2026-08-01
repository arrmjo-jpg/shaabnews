import { Clock, Eye, Play, Star } from 'lucide-react';
import Link from 'next/link';

import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { VideoItem } from '@/lib/videos';

// بطاقة فيديو موحّدة (premium، مربّعة) — صورة 16:9 + تدرّج + overlay مرور + زرّ تشغيل (يظهر بالمرور **وبالتركيز بلوحة
// المفاتيح**) + شارة مدّة + شارة «مميّز» (حقيقيّة، شرطيّة) + عنوان + ميتا بأيقونات. **a11y**: المشاهدات بنصّ مخفيّ
// للقارئ (sr-only «مشاهدة»)؛ الأيقونات aria-hidden؛ رابط متراكب يحمل اسم الفيديو (focus-visible عبر الإطار العامّ).
// مُقدِّميّة بحتة تُغذّى بـ`VideoItem` (S1). لا بوستر ⇒ خلفية محايدة (لا تلفيق). أدوات لوجيّة، tokens.
export function VideoCard({
  video,
  showCategory = true,
  priority = false,
  className = '',
}: {
  video: VideoItem;
  showCategory?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`group relative flex flex-col transition-transform duration-300 ease-out hover:-translate-y-1 focus-within:-translate-y-1 motion-reduce:transform-none ${className}`}
    >
      <Link href={video.href} className="absolute inset-0 z-10" aria-label={video.title} />

      <div className="relative aspect-video w-full overflow-hidden bg-surface-2 shadow-sm ring-1 ring-transparent transition-all duration-300 group-hover:shadow-lg group-hover:ring-border group-focus-within:shadow-lg group-focus-within:ring-border">
        {video.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء (لا next/image على شبكات الوسائط)
          <img
            src={video.poster}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}

        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10 group-focus-within:bg-black/10"
          aria-hidden
        />

        {video.isFeatured && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            <Star className="size-3" fill="currentColor" aria-hidden />
            مميّز
          </span>
        )}

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="flex size-12 scale-90 items-center justify-center bg-primary text-white opacity-0 shadow-lg transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 motion-reduce:transition-none"
            style={{ borderRadius: 9999 }}
          >
            <Play className="size-5 translate-x-px" fill="currentColor" aria-hidden />
          </span>
        </span>

        {video.durationLabel && (
          <span className="absolute bottom-2 end-2 bg-black/80 px-1.5 py-0.5 text-caption font-bold tabular-nums text-white">
            {video.durationLabel}
          </span>
        )}
      </div>

      <div className="pt-3">
        {showCategory && video.category && (
          <span className="text-caption font-extrabold text-primary">{video.category.name}</span>
        )}
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-[15px]">
          {video.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="size-3.5 shrink-0" aria-hidden />
            {formatNumber(video.views)}
            <span className="sr-only">مشاهدة</span>
          </span>
          {video.publishedAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <time dateTime={video.publishedAt}>{formatRelativeTime(video.publishedAt)}</time>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
