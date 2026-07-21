import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { FollowButton } from '@/components/sport/follow-button';
import { getMyFollows, type FollowedEntity } from '@/lib/follow';

// صفحة «أتابعهم» — قائمة متابعات المستخدم مُجمَّعة بالنوع (فرق/بطولات/لاعبون/مباريات)، كلّ عنصر رابطٌ لصفحته
// + زرّ متابعة لإلغائها. per-user ⇒ ديناميكيّة (no-store)؛ الزائر يُحوَّل لـ/login. الأسماء/الشعارات من 365.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'أتابعهم' };

const GROUPS: { type: FollowedEntity['type']; title: string }[] = [
  { type: 'team', title: 'الفرق' },
  { type: 'competition', title: 'البطولات' },
  { type: 'player', title: 'اللاعبون' },
  { type: 'match', title: 'المباريات' },
];

export default async function FollowingPage() {
  const { authed, items } = await getMyFollows();
  if (!authed) redirect('/login?returnTo=/sport/following');

  return (
    <div className="bg-surface-2">
      <Container className="py-6">
        <Link
          href="/sport"
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-fg"
        >
          <ChevronRight className="size-4" />
          الرياضة
        </Link>
        <h1 className="mb-6 text-xl font-extrabold text-fg sm:text-2xl">أتابعهم</h1>

        {items.length === 0 ? (
          <div className="border border-border bg-white p-8 text-center text-sm text-muted">
            لا تتابع أيّ فريق أو بطولة أو لاعب بعد. اضغط «تابع» على أيّ صفحة لإضافته هنا.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {GROUPS.map((g) => {
              const list = items.filter((i) => i.type === g.type);
              if (list.length === 0) return null;
              return (
                <section key={g.type} dir="rtl" className="border border-border bg-white">
                  <div className="border-b border-border px-4 py-2.5">
                    <h2 className="text-sm font-extrabold text-fg">{g.title}</h2>
                  </div>
                  <ul className="divide-y divide-border">
                    {list.map((it) => (
                      <li key={`${it.type}-${it.id}`} className="flex items-center gap-3 px-4 py-3">
                        <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-primary">
                          <span className="avatar flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2">
                            {it.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- شعار/صورة 365 من CDN
                              <img src={it.image} alt="" loading="lazy" className="size-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-muted">{(it.name || '?').slice(0, 1)}</span>
                            )}
                          </span>
                          <span className="truncate text-sm font-bold text-fg">{it.name || '—'}</span>
                        </Link>
                        <FollowButton type={it.type} id={it.id} compact />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
