import Link from 'next/link';

// ويدجت قائمة عامّ (نمط 365: لوحة بيضاء + ترويسة + صفوف مضغوطة) — يُعاد استخدامه للبطولات/الفِرق/الدول.
// عنصر برابط `href` ⇒ صفّ قابل للنقر (`<Link>` لصفحة التفاصيل، مثل بطاقة 365). شعار حقيقيّ أو مربّع لون+حرف (لا تلفيق).
export interface EntityRow {
  id: number;
  name: string;
  image: string | null;
  color?: string | null;
  sub?: string | null;
  href?: string | null;
}

export function EntityListBlock({ title, items }: { title: string; items: EntityRow[] }) {
  if (!items.length) return null;
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-extrabold text-fg">{title}</h3>
      </div>
      <ul>
        {items.map((it) => {
          const inner = (
            <>
              <EntityIcon it={it} />
              <span className="line-clamp-1 flex-1 text-sm font-bold text-fg">{it.name}</span>
              {it.sub ? <span className="shrink-0 text-[11px] font-bold text-muted tabular-nums">{it.sub}</span> : null}
            </>
          );
          const cls = 'flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2';
          return (
            <li key={it.id} className="border-b border-border last:border-b-0">
              {it.href ? (
                <Link href={it.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EntityIcon({ it }: { it: EntityRow }) {
  if (it.image) {
    // eslint-disable-next-line @next/next/no-img-element -- شعار/علم 365 من CDN
    return <img src={it.image} alt="" loading="lazy" decoding="async" className="size-6 shrink-0 object-contain" />;
  }
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center text-[10px] font-extrabold text-white"
      style={{ backgroundColor: it.color ?? '#9aa0a6' }}
      aria-hidden
    >
      {(it.name || '?').slice(0, 1)}
    </span>
  );
}
