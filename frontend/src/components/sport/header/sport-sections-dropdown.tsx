'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// شجرة القوائم بعد الحلّ الكامل (Server، sport-primary-nav.tsx) — كل عقدة تملك href صالحًا
// بالفعل (لا شيء هنا يُحلّ رابطًا أو يُخفي عقدة: مكوّن عرض بحت). عقدة لها children ⇒ Submenu،
// وإلا رابط مباشر — نفس القاعدة على أي عمق.
export interface ResolvedSportMenuNode {
  id: number;
  title: string;
  icon: string | null;
  href: string;
  children: ResolvedSportMenuNode[];
}

// نفس منطق HoverDropdownMenu في main-nav.tsx (News) حرفيًّا — أُعيد هنا محليًّا بدل تعديل ملف
// News (خارج نطاق هذا الـCommit) لجعله مشتركًا؛ كلاهما يبني على نفس Radix primitives الجاهزة
// (@/components/ui/dropdown-menu)، لا منطق تفاعل جديد يُخترَع.
// المدّتان أدناه مطابقتان لـmain-nav.tsx حرفيًّا (fix الوميض/القفزة عند hover سريع — أُبقيتا هنا
// بنفس التكرار المقصود أعلاه بدل استخراج hook مشترك).
const OPEN_INTENT_MS = 75;
const CLOSE_GRACE_MS = 150;

function HoverDropdownMenu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (open || openTimeoutRef.current) return;
    openTimeoutRef.current = setTimeout(() => {
      openTimeoutRef.current = null;
      setOpen(true);
    }, OPEN_INTENT_MS);
  };
  const handleMouseLeave = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setOpen(false);
    }, CLOSE_GRACE_MS);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} dir="rtl">
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative inline-flex">
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="nav-mega-menu-content data-[state=open]:duration-[220ms] data-[state=open]:ease-out data-[state=closed]:duration-[170ms] data-[state=closed]:ease-in data-[side=bottom]:data-[state=open]:slide-in-from-top-2 data-[side=bottom]:data-[state=closed]:slide-out-to-top-2 data-[side=top]:data-[state=open]:slide-in-from-bottom-2 data-[side=top]:data-[state=closed]:slide-out-to-bottom-2 data-[side=left]:data-[state=open]:slide-in-from-right-2 data-[side=left]:data-[state=closed]:slide-out-to-right-2 data-[side=right]:data-[state=open]:slide-in-from-left-2 data-[side=right]:data-[state=closed]:slide-out-to-left-2"
        >
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

// عقدة واحدة — Submenu (Radix Sub، يفتح بالتمرير تلقائيًّا داخل قائمة مفتوحة) إن وُجدت children،
// وإلا رابط مباشر. نفسها تُستدعى تكراريًّا لأي عمق، بلا حدّ أقصى مفترَض.
function MenuNode({ node }: { node: ResolvedSportMenuNode }) {
  if (node.children.length === 0) {
    return (
      <DropdownMenuItem asChild>
        <Link href={node.href}>{node.title}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{node.title}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {node.children.map((child) => (
          <MenuNode key={child.id} node={child} />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// لا عنصر يُحلّ إلى رابط حقيقي ⇒ إخفاء الزرّ بالكامل (حالة صادقة، لا زرّ معطَّل بلا فائدة). الحلّ
// نفسه (وتصفية غير القابل للحلّ) يحدث الآن بالكامل في sport-primary-nav.tsx قبل الوصول هنا.
export function SportSectionsDropdown({ items }: { items: ResolvedSportMenuNode[] }) {
  if (items.length === 0) return null;

  return (
    <HoverDropdownMenu
      trigger={
        <button
          type="button"
          className="flex items-center gap-1 rounded-sm text-base font-bold text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=open]:text-fg motion-reduce:transition-none"
        >
          الأقسام
          <ChevronDownIcon className="size-4" aria-hidden />
        </button>
      }
    >
      {items.map((item) => (
        <MenuNode key={item.id} node={item} />
      ))}
    </HoverDropdownMenu>
  );
}
