import { LivePulse } from '@/components/ui/live-pulse';

// ترويسة المقال: شارات (مباشر/عاجل/تغطية خاصة/رأي) + العنوان + العنوان الفرعي بالأحمر.
// مكوّن عرض بحت — يستقبل قيمًا محسوبة مسبقًا من `article-detail.tsx` (لا اتصال شبكي/بيانات هنا).
interface ArticleHeaderProps {
  title: string;
  subtitle: string | null;
  isLive: boolean;
  isOpinion: boolean;
  breaking: boolean;
  featured: boolean;
}

export function ArticleHeader({ title, subtitle, isLive, isOpinion, breaking, featured }: ArticleHeaderProps) {
  const hasFlags = isLive || breaking || featured || isOpinion;

  return (
    <header className="mb-3">
      {hasFlags && (
        <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
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
          {isOpinion && <span className="px-3 py-1 text-xs font-bold text-fg bg-surface-3">رأي</span>}
        </div>
      )}

      <h1 className="text-[18px] font-extrabold leading-relaxed text-fg">{title}</h1>

      {subtitle && (
        <h2 className="text-[16px] sm:text-[18px] font-bold leading-relaxed text-primary mt-2">{subtitle}</h2>
      )}
    </header>
  );
}
