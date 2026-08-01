import { LivePulse } from '@/components/ui/live-pulse';

// صورة الهيرو (تعويم يسار على الشاشات الكبيرة عبر .editorial-float-left في globals.css).
//
// ملاحظة تكيّف متعمَّدة عن النسخة المرجعية (D:\gasem\frontend): نوع `ArticleImage` في هذا المشروع
// (lib/articles.ts) لا يحمل width/height/photographer/source، ولا يحمل ArticleDetail حقلي
// hasVideo/video — هذه الحقول غير موجودة في مخطّط الـZod الحالي. بدل توسيع الـDTO لهذه الحقول
// (ممنوع صراحةً في مهمّة النقل البصري الأصليّة)، استُبدلت نسبة الارتفاع الديناميكية بنسبة ثابتة
// 16:9، وحُذفت شارة المصوّر/المصدر وزر تشغيل الفيديو المضمّن. الشارات (مباشر/عاجل/تغطية خاصة)
// بصريًّا مطابقة تمامًا. caption أُضيف لاحقاً (وصف الصورة) — يُعرَض كسطر تحت الغلاف عند وجوده.
interface HeroCover {
  url: string;
  medium: string | null;
  alt: string | null;
  caption: string | null;
}

interface HeroImageProps {
  cover: HeroCover | null;
  defaultTitle: string;
  isLive?: boolean;
  breaking?: boolean;
  featured?: boolean;
}

export function ArticleHero({ cover, defaultTitle, isLive = false, breaking = false, featured = false }: HeroImageProps) {
  if (!cover || !cover.url) return null;

  return (
    <figure className="w-full my-6 lg:my-0 lg:mb-4 overflow-hidden border border-border/80 bg-surface-2 editorial-float-left group">
      <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: أعلى الطيّة، أداء أوّلي */}
        <img
          // medium وليس url: الأصل الخام يبقى نظيفاً عمداً (بلا علامة مائية) — MediaConversions
          // تختم thumb/medium فقط عند تفعيل العلامة من الإعدادات. صورة الهيرو هي أكثر صورة ظهوراً
          // وقابلية للقصّ/إعادة النشر في المقال، فعرض url هنا كان يُسقط العلامة عن أبرز صورة تماماً
          // رغم تفعيلها. fallback إلى url فقط حين medium غير متاح (مثال: صورة كاتب افتراضية).
          src={cover.medium ?? cover.url}
          alt={cover.alt ?? defaultTitle}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />

        {(isLive || breaking || featured) && (
          <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-1.5 print:hidden">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-primary">
                <LivePulse />
                <span>مباشر الآن</span>
              </span>
            )}
            {breaking && (
              <span className="px-3 py-1 text-xs font-bold text-white bg-[#dc2626] animate-pulse">عاجل</span>
            )}
            {featured && <span className="px-3 py-1 text-xs font-bold text-white bg-primary">تغطية خاصة</span>}
          </div>
        )}
      </div>
      <div className="featured-accent-marker" aria-hidden />

      {cover.caption && (
        <figcaption className="px-2 py-1.5 text-xs text-muted">{cover.caption}</figcaption>
      )}
    </figure>
  );
}
