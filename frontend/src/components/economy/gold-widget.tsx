import { Coins } from 'lucide-react';
import Link from 'next/link';

import type { GoldPrices, GoldRow } from '@/lib/gold';

import { ChangePill, GOLD } from './gold-table';

// ويدجت أسعار الذهب (يحلّ محلّ البطاقة الخامسة جوار الأخبار الأربعة) — نسخة مصغّرة من «لوحة الذهب»:
// رأس داكن ذهبيّ + إبراز عيار 24 (ميدالية + سعر كبير) + صفوف مدمجة لبقيّة العيارات/الليرات.
// قيم حقيقيّة فقط؛ لا بيانات ⇒ حالة فارغة ذهبيّة (لا تلفيق).
export function GoldWidget({ gold, className = '' }: { gold: GoldPrices | null; className?: string }) {
  const rows = gold ? [...gold.karats, ...gold.liras] : [];

  if (!gold || rows.length === 0) {
    return (
      <Link
        href="/gold-prices"
        className={`flex min-h-[200px] flex-col items-center justify-center gap-2 bg-white p-6 text-center shadow-sm transition-opacity hover:opacity-90 ${className}`}
        style={{ borderRadius: '14px' }}
      >
        <span className="flex size-12 items-center justify-center opacity-85" style={{ background: GOLD, borderRadius: '9999px' }} aria-hidden>
          <Coins className="size-6 text-[#3a2c08]" />
        </span>
        <p className="text-sm font-extrabold text-fg">أسعار الذهب</p>
        <p className="text-xs text-muted">الأسعار غير متاحة حاليّاً</p>
        <span className="mt-1 text-xs font-bold text-primary">أرشيف الأسعار ←</span>
      </Link>
    );
  }

  const [head, ...rest] = rows;
  const headIsKarat = /^\d+$/.test(head.key);

  return (
    <Link
      href="/gold-prices"
      className={`flex flex-col overflow-hidden bg-white shadow-sm transition-opacity hover:opacity-95 ${className}`}
      style={{ borderRadius: '14px' }}
    >
      {/* شريط ذهبيّ علويّ */}
      <div className="h-1" style={{ background: GOLD }} aria-hidden />

      {/* رأس داكن ذهبيّ */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-amber-50" style={{ background: '#17120a' }}>
        <span className="flex items-center gap-1.5 text-sm font-extrabold">
          <Coins className="size-4" style={{ color: '#e7c668' }} aria-hidden />
          أسعار الذهب
        </span>
        <span className="text-[10px] font-medium text-amber-100/55">د.أ/غرام</span>
      </div>

      {/* إبراز عيار 24 — ميدالية + سعر كبير */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center text-sm font-extrabold text-[#3a2c08]"
          style={{ background: GOLD, borderRadius: '9999px', boxShadow: 'inset 0 1px 2px rgba(255,255,255,.5)' }}
          aria-hidden
        >
          {headIsKarat ? head.key : <Coins className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-muted">{head.label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tabular-nums text-fg">{head.sell.toFixed(2)}</span>
            <span className="text-[9px] text-muted">شراء {head.buy.toFixed(2)}</span>
          </div>
        </div>
        <ChangePill up={head.up} pct={head.pct} />
      </div>

      {/* صفوف بقيّة العيارات/الليرات */}
      <div className="flex flex-1 flex-col divide-y divide-border/70">
        {rest.map((r) => (
          <CompactRow key={r.key} row={r} />
        ))}
      </div>

      {/* تذييل: آخر تحديث + التفاصيل */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px]">
        {gold.updatedRelative ? (
          <span className="truncate text-muted">{gold.updatedRelative}</span>
        ) : (
          <span />
        )}
        <span className="shrink-0 font-bold text-primary">
          التفاصيل ←
        </span>
      </div>
    </Link>
  );
}

function CompactRow({ row }: { row: GoldRow }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="truncate text-xs font-bold text-fg">{row.label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-extrabold tabular-nums text-fg">{row.sell.toFixed(2)}</span>
        <ChangePill up={row.up} pct={row.pct} />
      </div>
    </div>
  );
}
