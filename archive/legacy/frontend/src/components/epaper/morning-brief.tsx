import type { BriefPoint } from '@/lib/epaper';

// نشرة اليوم — نقاط منتقاة (عنوان + لماذا يهمّ). قسم تحريريّ اختياريّ: يظهر فقط عند وجود
// محتوى منتقى؛ فارغ ⇒ لا يُعرَض (لا صندوق فارغ للقارئ، ولا تلفيق).
export function MorningBrief({ points }: { points: BriefPoint[] }) {
  if (points.length === 0) return null;

  return (
    <section className="mt-10" dir="rtl" aria-labelledby="epaper-brief-heading">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <span className="h-6 w-1.5 shrink-0 bg-primary" aria-hidden />
        <h2 id="epaper-brief-heading" className="text-xl font-extrabold text-fg">
          نشرة اليوم
        </h2>
      </div>

      <ol className="mt-4 grid gap-4">
        {points.map((p, i) => (
          <li key={i} className="border-b border-border pb-4 last:border-0">
            <h3 className="text-base font-bold text-fg">{p.title}</h3>
            {p.why ? <p className="mt-1 text-sm text-muted">{p.why}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
