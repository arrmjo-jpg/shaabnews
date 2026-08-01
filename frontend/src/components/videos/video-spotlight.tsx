import { Clock, Eye, Play } from 'lucide-react';
import Link from 'next/link';

import { formatNumber, formatRelativeTime } from '@/lib/format';
import type { VideoItem } from '@/lib/videos';

// «سبوت لايت» الفيديو — مفتتح فاخر بؤريّ: بطاقة رئيسيّة كبيرة (lead) بعنوان مهيمن متراكب + قائمة جانبيّة (up-next).
// مُقدِّميّ بحت (props من S1). سطح المكتب: عمودان (lead 7 + قائمة 5)؛ الجوّال: lead ثمّ ٣ صفوف فقط (تقليم الطول).
// زرّ التشغيل يظهر بالمرور **وبالتركيز بلوحة المفاتيح** (focus-within). a11y: المشاهدات بنصّ مخفيّ، الأيقونات aria-hidden.
// صورة الـlead للـLCP (eager)، البقيّة lazy. مربّع/لوجيّ/tokens.
export function VideoSpotlight({ lead, items }: { lead: VideoItem; items: VideoItem[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
      {/* البطاقة الرئيسيّة (lead) */}
      <article className="group relative lg:col-span-7">
        <Link href={lead.href} className="absolute inset-0 z-10" aria-label={lead.title} />
        <div className="relative aspect-video w-full overflow-hidden bg-surface-2 ring-1 ring-transparent transition-all duration-300 group-hover:ring-border group-focus-within:ring-border">
          {lead.poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: صورة LCP للمفتتح
            <img
              src={lead.poster}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="size-full bg-surface-3" aria-hidden />
          )}
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent"
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="flex size-16 scale-90 items-center justify-center bg-primary text-white opacity-0 shadow-xl transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 motion-reduce:transition-none"
              style={{ borderRadius: 9999 }}
            >
              <Play className="size-7 translate-x-0.5" fill="currentColor" aria-hidden />
            </span>
          </span>
          {lead.durationLabel && (
            <span className="absolute bottom-3 end-3 bg-black/80 px-2 py-0.5 text-sm font-bold tabular-nums text-white">
              {lead.durationLabel}
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] p-4 sm:p-6">
          {lead.category && <span className="text-caption font-extrabold text-white/90">{lead.category.name}</span>}
          <h3 className="mt-1 line-clamp-2 text-xl font-extrabold leading-tight text-white underline-offset-2 group-hover:underline group-has-[:focus-visible]:underline sm:text-2xl lg:text-3xl">
            {lead.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-white/80">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="size-3.5" aria-hidden />
              {formatNumber(lead.views)}
              <span className="sr-only">مشاهدة</span>
            </span>
            {lead.publishedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                <time dateTime={lead.publishedAt}>{formatRelativeTime(lead.publishedAt)}</time>
              </span>
            )}
          </div>
        </div>
      </article>

      {/* القائمة الجانبيّة (up-next) — ٣ صفوف على الجوّال، الكلّ على سطح المكتب */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3 lg:col-span-5">
          {items.map((v, i) => (
            <div key={v.id} className={i >= 3 ? 'hidden lg:block' : ''}>
              <SpotlightRow video={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpotlightRow({ video }: { video: VideoItem }) {
  return (
    <article className="group relative flex gap-3">
      <Link href={video.href} className="absolute inset-0 z-10" aria-label={video.title} />
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
        {video.durationLabel && (
          <span className="absolute bottom-1 end-1 bg-black/80 px-1 py-0.5 text-[10px] font-bold tabular-nums text-white">
            {video.durationLabel}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {video.category && <span className="text-[10px] font-extrabold text-primary">{video.category.name}</span>}
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
