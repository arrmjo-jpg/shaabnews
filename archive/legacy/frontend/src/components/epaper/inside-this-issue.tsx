import Link from 'next/link';

import type { InsideSection } from '@/lib/epaper';

// داخل هذا العدد — أقسام (قسم + أبرز موضوع + صفحة) مع انتقال مباشر للقارئ عند توفّر الصفحة.
// قسم تحريريّ اختياريّ: يظهر فقط عند وجود فهرس منتقى؛ فارغ ⇒ لا يُعرَض (لا صندوق فارغ، لا تلفيق).
export function InsideThisIssue({ sections, readHref }: { sections: InsideSection[]; readHref: string }) {
  if (sections.length === 0) return null;

  return (
    <section className="mt-10" dir="rtl" aria-labelledby="epaper-contents-heading">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <span className="h-6 w-1.5 shrink-0 bg-primary" aria-hidden />
        <h2 id="epaper-contents-heading" className="text-xl font-extrabold text-fg">
          داخل هذا العدد
        </h2>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {sections.map((s, i) => {
          const inner = (
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="font-bold text-fg">{s.label}</span>
                {s.lead ? <span className="ms-2 text-sm text-muted">{s.lead}</span> : null}
              </span>
              {s.page ? <span className="shrink-0 text-xs text-muted">ص {s.page}</span> : null}
            </span>
          );
          return (
            <li key={i} className="border-b border-border py-2.5">
              {s.page ? (
                <Link href={`${readHref}/p/${s.page}`} className="block transition-colors hover:text-primary">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
