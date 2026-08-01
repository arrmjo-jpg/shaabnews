import { Play } from 'lucide-react';
import Link from 'next/link';

import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { VideoItem } from '@/lib/videos';

// صفّ فيديو مدمج (مصغّرة + عنوان + ميتا) — لقوائم الـSidebar في صفحة المشاهدة (ذات صلة / قائمة تشغيل). `active`
// يميّز المعروض حاليّاً (خلفيّة + «يُعرض الآن» + تراكب تشغيل). مُقدِّميّ بحت؛ الرابط من `video.href` (قد يحمل سياق
// `?playlist=` يُمرَّر من الصفحة). a11y: المشاهدات بنصّ مخفيّ، الأيقونات aria-hidden. مربّع/لوجيّ/tokens.
export function VideoListItem({ video, active = false }: { video: VideoItem; active?: boolean }) {
  return (
    <article
      className={`group relative flex gap-3 p-2 transition-colors ${active ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
    >
      <Link
        href={video.href}
        className="absolute inset-0 z-10"
        aria-label={video.title}
        aria-current={active ? 'true' : undefined}
      />
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden bg-surface-2 sm:w-40">
        {video.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء
          <img
            src={video.poster}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40" aria-hidden>
            <span className="flex size-7 items-center justify-center bg-primary text-white" style={{ borderRadius: 9999 }}>
              <Play className="size-3.5 translate-x-px" fill="currentColor" />
            </span>
          </span>
        )}
        {video.durationLabel && (
          <span className="absolute bottom-1 end-1 bg-black/80 px-1 py-0.5 text-[10px] font-bold tabular-nums text-white">
            {video.durationLabel}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {active && <span className="text-[10px] font-extrabold text-primary">يُعرض الآن</span>}
        <h4 className="line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline">
          {video.title}
        </h4>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="tabular-nums">
            {formatNumber(video.views)}
            <span className="sr-only"> مشاهدة</span>
          </span>
          {video.publishedAt && <time dateTime={video.publishedAt}>· {formatRelativeTime(video.publishedAt)}</time>}
        </div>
      </div>
    </article>
  );
}
