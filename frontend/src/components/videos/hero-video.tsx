import { Clock, Eye, Play } from 'lucide-react';
import Link from 'next/link';

import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { VideoItem } from '@/lib/videos';

// هيرو فيديو سينمائيّ (مُقدِّميّ، خادم) — بوستر تكيّفيّ (16:9 جوّال → 2:1 لوحيّ → 21:9 سطح مكتب) + تدرّج قويّ
// + شارة «مميّز»(حقيقيّة، الهيرو من المميّز) + تصنيف + عنوان display + ميتا بأيقونات + زرّ «شاهد الآن». صورة LCP
// (eager + fetchPriority=high). رابط متراكب يغطّي البطاقة (الزرّ بصريّ). لا فيديو ⇒ null (صادق، لا تلفيق).
export function HeroVideo({
  video,
  watchLabel = 'شاهد الآن',
}: {
  video: VideoItem | null;
  watchLabel?: string;
}) {
  if (!video) return null;

  return (
    <article className="group relative isolate overflow-hidden bg-ink text-white">
      <Link href={video.href} className="absolute inset-0 z-10" aria-label={video.title} />

      <div className="relative aspect-[16/9] w-full sm:aspect-[2/1] lg:aspect-[21/9]">
        {video.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: صورة LCP للهيرو
          <img
            src={video.poster}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
          aria-hidden
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-12">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 bg-primary px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white">
            {video.isFeatured ? 'مميّز' : 'الأحدث'}
            {video.category ? ` · ${video.category.name}` : ''}
          </span>
          <h2 className="mt-3 text-2xl font-extrabold leading-[1.1] underline-offset-2 group-hover:underline group-has-[:focus-visible]:underline sm:text-4xl lg:text-5xl">{video.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="size-4 shrink-0" aria-hidden />
              {formatNumber(video.views)}
              <span className="sr-only">مشاهدة</span>
            </span>
            {video.publishedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4 shrink-0" aria-hidden />
                <time dateTime={video.publishedAt}>{formatRelativeTime(video.publishedAt)}</time>
              </span>
            )}
            {video.durationLabel && <span className="tabular-nums">{video.durationLabel}</span>}
          </div>
          <span className="mt-5 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-bold text-white shadow-xl transition group-hover:brightness-110">
            <Play className="size-5" fill="currentColor" aria-hidden />
            {watchLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
