'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SportMenuItemNode } from '@/lib/sport-menu';

// خرائط section_key الوظيفيّة إلى مسارات حقيقيّة موجودة اليوم فقط. section_key بلا صفحة قائمة
// حقيقيّة (competitions/teams/players: توجد صفحة تفاصيل فردية فقط، لا قائمة؛ predictions: ميزة
// غير مبنية إطلاقًا) يُخفى بدل الربط بصفحة 404 — نفس انضباط "لا تلفيق" المتَّبع في بقيّة محرّك
// الرياضة (مثال: competition-header.tsx لأقسام بلا بيانات في الـAPI العامّ).
const SECTION_ROUTES: Record<string, string> = {
  matches: '/sport',
};

// عناصر type=category تحتاج تحويل category_id → رابط حقيقي (slug/ancestry عبر categoryHref).
// عقد /api/v1/sport-menu الحاليّ (Commit 4) لا يعيد سوى المعرّف الرقميّ الخام — لا مصدر آمن لبناء
// الرابط من الواجهة وحدها دون تعديل الباك إند (خارج نطاق هذا الـCommit، فرونت‑إند فقط) — تُخفى
// أيضًا حتى تضيف مرحلة لاحقة slug/href جاهزَين إلى العقد العامّ.
function resolveHref(item: SportMenuItemNode): string | null {
  if (item.type === 'section' && item.section_key) return SECTION_ROUTES[item.section_key] ?? null;
  return null;
}

// نفس منطق HoverDropdownMenu في main-nav.tsx (News) حرفيًّا — أُعيد هنا محليًّا بدل تعديل ملف
// News (خارج نطاق هذا الـCommit) لجعله مشتركًا؛ كلاهما يبني على نفس Radix primitives الجاهزة
// (@/components/ui/dropdown-menu)، لا منطق تفاعل جديد يُخترَع.
function HoverDropdownMenu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} dir="rtl">
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative inline-flex">
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

// لا عنصر يُحلّ إلى رابط حقيقي ⇒ إخفاء الزرّ بالكامل (حالة صادقة، لا زرّ معطَّل بلا فائدة).
export function SportSectionsDropdown({ items }: { items: SportMenuItemNode[] }) {
  const resolved = items
    .map((item) => ({ item, href: resolveHref(item) }))
    .filter((x): x is { item: SportMenuItemNode; href: string } => x.href !== null);

  if (resolved.length === 0) return null;

  return (
    <HoverDropdownMenu
      trigger={
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-bold text-muted outline-none transition-colors hover:text-fg data-[state=open]:text-fg"
        >
          الأقسام
          <ChevronDownIcon className="size-4" aria-hidden />
        </button>
      }
    >
      {resolved.map(({ item, href }) => (
        <DropdownMenuItem key={item.id} asChild>
          <Link href={href}>{item.title}</Link>
        </DropdownMenuItem>
      ))}
    </HoverDropdownMenu>
  );
}
