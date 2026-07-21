import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { FollowButton } from '@/components/sport/follow-button';
import type { CompetitionProfile } from '@/lib/sport/domain/entities';

export interface CompetitionTab {
  id: string;
  label: string;
}

// كلّ أقسام البطولة (قرار صاحب المنتج: تُعرض كاملةً كنمط 365، الترتيب: التفاصيل أوّلاً). مصدر واحد (DRY)
// تستعمله صفحة البطولة وهيدر المباراة معاً. الأقسام بلا بيانات في الـAPI العامّ (ملاحظات، تفاصيل خروج
// المغلوب) تُعرض بحالة صادقة في صفحة البطولة — لا تُحذف من الهيدر ولا تُلفَّق.
export const COMPETITION_TABS: CompetitionTab[] = [
  { id: 'overview', label: 'التفاصيل' },
  { id: 'matches', label: 'المباريات' },
  { id: 'standings', label: 'المجموعات' },
  { id: 'news', label: 'أخبار' },
  { id: 'brackets', label: 'خروج المغلوب' },
  { id: 'stats', label: 'الإحصائيات' },
  { id: 'insights', label: 'ملاحظات' },
  { id: 'champions', label: 'الأبطال' },
];

function tabHref(id: string, cid: number): string {
  return id === 'overview' ? `/sport/competition/${cid}` : `/sport/competition/${cid}?tab=${id}`;
}

// هيدر البطولة (mega-header بنمط 365، داكن، كامل العرض): شعار + اسم + كلّ التبويبات. يُشتقّ بالكامل من
// `meta` (البطولة التابعة للصفحة) ⇒ لا هيدر/روابط ثابتة، ويتغيّر تلقائيّاً باختلاف البطولة. يُعاد استخدامه:
// صفحة البطولة (activeTab = التبويب الحاليّ) + أعلى صفحة المباراة (activeTab = null، البطولة من competitionId).
export function CompetitionHeader({
  meta,
  activeTab = null,
}: {
  meta: CompetitionProfile;
  activeTab?: string | null;
}) {
  const base = `/sport/competition/${meta.id}`;

  return (
    <section dir="rtl" className="border-b border-border bg-[#10181d] text-white">
      <Container>
        {/* صفّ واحد: الشعار + الاسم (يمين RTL) ثمّ كلّ التبويبات (تملأ ما تبقّى، تمرير أفقيّ). */}
        <div className="flex items-center gap-4 py-2.5">
          <Link href={base} className="flex min-w-0 shrink-0 items-center gap-2.5">
            {meta.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
              <img src={meta.logo} alt="" className="size-10 shrink-0 object-contain" />
            ) : (
              <span className="avatar flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-extrabold">
                {(meta.name || '?').slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold leading-tight">{meta.name}</span>
              {meta.country && <span className="block truncate text-[11px] text-white/55">{meta.country}</span>}
            </span>
          </Link>

          <nav dir="rtl" className="flex flex-1 gap-1 overflow-x-auto">
            {COMPETITION_TABS.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <Link
                  key={t.id}
                  href={tabHref(t.id, meta.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition-colors ' +
                    (isActive ? 'border-primary text-white' : 'border-transparent text-white/55 hover:text-white')
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <FollowButton type="competition" id={meta.id} dark compact className="self-center" />
        </div>
      </Container>
    </section>
  );
}
