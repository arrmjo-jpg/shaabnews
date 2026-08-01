'use client';

import type { SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BasketballIcon,
  FootballIcon,
  HandballIcon,
  TennisIcon,
  VolleyballIcon,
} from '@/components/sport/sport-icons';
import { SportsNavScroller } from '@/components/sport/sports-nav-scroller';
import { activeSportKeyFromPathname, SPORTS, sportHref } from '@/lib/sport/sports';

// منيو الرياضات — الآن جزء من هيكل SportHeader (كروم ثابت عبر كل صفحات /sport/**)، لا من محتوى
// صفحة بعينها — لذا الرياضة النشطة تُشتَقّ من المسار الحاليّ (usePathname، نفس نمط MobileBottomNav
// تمامًا)، لا من Prop قادم من صفحة (Layout يقع فوق مقطع [sport]، لا يملك ذلك الـparam أصلًا).
// هذا وحده سبب صيرورة هذا المكوّن Client — التمرير/الأسهم/لوحة المفاتيح يبقيان معزولين تمامًا
// داخل SportsNavScroller كما كانا (لم يتغيّر ذلك الملف بهذه الجولة).
//
// شكل شريط تنقّل حقيقيّ — عمدًا بلا بطاقة/صندوق/حدّ/عرض ثابت (قرار صريح: لا card ولا tile ولا
// flex-1 ولا min-width). كل عنصر عرضه الطبيعيّ حسب محتواه (أيقونة + نصّ جنبًا إلى جنب على سطر
// واحد، لا مكدَّسين). النشط يتمايز بالنصّ فقط (أفتح + أعرض وزنًا) + خطّ سفليّ رفيع بلون العلامة —
// لا خلفيّة حمراء ممتلئة كسابقًا.
const ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  football: FootballIcon,
  basketball: BasketballIcon,
  tennis: TennisIcon,
  handball: HandballIcon,
  volleyball: VolleyballIcon,
};

export function SportsNav() {
  const pathname = usePathname();
  const active = activeSportKeyFromPathname(pathname);

  return (
    <nav dir="rtl" aria-label="الرياضات">
      <SportsNavScroller ariaLabel="الرياضات">
        {SPORTS.map((s) => {
          const Icon = ICONS[s.key] ?? FootballIcon;
          const isActive = s.key === active;
          return (
            <Link
              key={s.key}
              href={sportHref(s)}
              aria-current={isActive ? 'page' : undefined}
              className={
                'inline-flex shrink-0 scroll-ms-3 snap-start items-center gap-1.5 border-b-2 px-1 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none ' +
                (isActive ? 'border-primary font-bold text-fg' : 'border-transparent font-semibold text-muted hover:text-fg')
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{s.label}</span>
            </Link>
          );
        })}
      </SportsNavScroller>
    </nav>
  );
}
