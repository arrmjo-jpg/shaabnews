import type { Metadata } from 'next';
import { Users } from 'lucide-react';

import { Container } from '@/components/layout/container';
import { TeamMemberCard } from '@/components/team/team-member-card';
import { buildMetadata } from '@/lib/seo';
import { getTeamGroups } from '@/lib/team';

// صفحة فريق العمل — قائمة الأعضاء النشِطين مُجمّعة حسب القسم (بيانات جاهزة من الباك إند، بلا
// تجميع هنا)، بطاقة لكل عضو (صورة + اسم + مسمّى وظيفيّ) تفتح /team/{slug}. ISR — سقف أمان
// (الفريق نادر التغيّر)؛ لا تحديث حدثيّ مربوط بعد (راجع ملاحظة الـrevalidate في lib/team.ts).
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'فريق العمل',
    description: 'تعرّف على فريق العمل القائم على تحرير وإدارة الموقع.',
    path: '/team',
  });
}

export default async function TeamPage() {
  const groups = await getTeamGroups();
  const hasMembers = groups.some((g) => g.members.length > 0);

  return (
    <div dir="rtl">
      <div className="border-b border-border bg-surface-2">
        <Container className="py-9">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">فريق العمل</h1>
          <p className="mt-2 text-muted">تعرّف على فريق العمل القائم على تحرير وإدارة الموقع.</p>
        </Container>
      </div>

      <Container className="py-8 sm:py-10">
        {hasMembers ? (
          <div className="space-y-12">
            {groups.map((group, i) =>
              group.members.length === 0 ? null : (
                <section key={group.department ?? `__group_${i}`} aria-label={group.department ?? 'فريق العمل'}>
                  {group.department && (
                    <h2 className="mb-5 flex items-center gap-3 text-xl font-extrabold text-fg sm:text-2xl">
                      <span className="h-6 w-1.5 shrink-0 bg-primary" aria-hidden />
                      {group.department}
                    </h2>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {group.members.map((member) => (
                      <TeamMemberCard key={member.id} member={member} />
                    ))}
                  </div>
                </section>
              ),
            )}
          </div>
        ) : (
          <div className="mt-10 flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
            <Users className="size-14 text-muted" aria-hidden />
            <p className="text-lg font-bold text-fg">لا يوجد أعضاء فريق منشورون بعد</p>
            <p className="text-muted">ستظهر هنا بطاقات الفريق فور تفعيلها من لوحة التحرير.</p>
          </div>
        )}
      </Container>
    </div>
  );
}
