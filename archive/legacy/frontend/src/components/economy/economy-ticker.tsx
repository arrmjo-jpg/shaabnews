import { Building2 } from 'lucide-react';

// تيكر بورصة عمّان (الطبقة 1): أسماء شركات بورصة عمّان الحقيقيّة (ASE) فقط — الذهب له ويدجت مستقلّ.
// CSS marquee بلا JS، **لوب سلس لا نهائيّ** (نسختان متطابقتان)، سير يسار→يمين، **بلا توقّف** (لا توقّف عند المرور)،
// **خطّ أبيض**. السرعة تتناسب مع عدد الشركات (وتيرة بكسل ثابتة). يُخفى إن لا شركات.
export function EconomyTicker({ companies = [] }: { companies?: string[] }) {
  if (companies.length === 0) return null;

  // مدّة متناسبة مع المحتوى → وتيرة ثابتة مهما زاد عدد الشركات (وأسرع من قبل).
  const durationSec = Math.max(18, Math.round(companies.length * 0.85));

  return (
    <div className="acm-eticker relative overflow-hidden border-b border-white/10 bg-black/20 text-white">
      <style>{`
        /* نسختان متجاورتان؛ التحريك بمقدار نسخة واحدة (-50%) فيبدو متّصلاً بلا فراغ ولا توقّف */
        @keyframes acm-eticker-move { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .acm-eticker-track { animation: acm-eticker-move linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .acm-eticker-track { animation: none; transform: translateX(0); } }
      `}</style>
      <div className="flex items-stretch">
        {/* تسمية ثابتة */}
        <div className="z-10 flex shrink-0 items-center gap-1.5 bg-black/30 px-3 text-xs font-bold text-white sm:px-4">
          <span className="size-2 shrink-0 animate-pulse bg-emerald-400" style={{ borderRadius: '9999px' }} aria-hidden />
          <span className="whitespace-nowrap">بورصة عمّان</span>
        </div>

        {/* المسار — نسختان متطابقتان للّوب السلس. dir=ltr لحساب transform نظيف بمعزل عن RTL القسم. */}
        <div className="min-w-0 flex-1 overflow-hidden py-2">
          <div
            className="acm-eticker-track flex w-max items-center"
            dir="ltr"
            role="marquee"
            aria-label="شركات بورصة عمّان المالي"
            style={{ animationDuration: `${durationSec}s` }}
          >
            <CompanyGroup companies={companies} />
            <CompanyGroup companies={companies} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyGroup({ companies }: { companies: string[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {companies.map((name, i) => (
        <span
          key={i}
          className="flex items-center gap-1.5 whitespace-nowrap px-5 text-xs font-semibold text-white"
          dir="rtl"
        >
          <Building2 className="size-3.5 shrink-0 text-white/55" aria-hidden />
          {name}
        </span>
      ))}
    </div>
  );
}
