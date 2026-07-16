import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { EntityListBlock } from '@/components/sport/entity-list-block';
import { FollowButton } from '@/components/sport/follow-button';
import { StandingsTable } from '@/components/sport/standings-table';
import { buildMetadata } from '@/lib/seo';
import { getStandings, getTeam } from '@/lib/sport/stats';

// صفحة الفريق `/sport/team/[id]` (مثل 365 `/team/{id}`) — ترويسة + ترتيب دوريه الرئيس (صفّ الفريق مُميَّز) + بطولاته
// (روابط لصفحة البطولة). لا fixtures (نقطة مباريات الفريق لا تعمل) ⇒ لا تلفيق. الثابت «team» يسبق `[sport]`.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return buildMetadata({ title: 'الفريق', path: `/sport/team/${id}` });
  const team = await getTeam(tid);
  if (!team) return buildMetadata({ title: 'الفريق', path: `/sport/team/${tid}` });

  return buildMetadata({
    title: team.name,
    description: `ترتيب وبطولات فريق ${team.name}`,
    path: `/sport/team/${tid}`,
    type: 'website',
  });
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) notFound();
  const team = await getTeam(tid);
  if (!team) notFound();
  const standings = team.mainCompetitionId ? await getStandings(team.mainCompetitionId) : null;

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

        <div className="mb-6 flex items-center gap-3">
          {team.logo && (
            // eslint-disable-next-line @next/next/no-img-element -- شعار الفريق من CDN 365
            <img src={team.logo} alt="" className="size-12 object-contain" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-fg sm:text-2xl">{team.name}</h1>
            {team.country && <p className="text-xs text-muted">{team.country}</p>}
          </div>
          <FollowButton type="team" id={team.id} className="ms-auto" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <main className="min-w-0">
            {standings ? (
              <section dir="rtl" className="border border-border bg-white">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  {standings.competition.logo && (
                    // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
                    <img src={standings.competition.logo} alt="" className="size-6 shrink-0 object-contain" />
                  )}
                  <h2 className="text-sm font-extrabold text-fg">ترتيب {standings.competition.name}</h2>
                </div>
                <div className="px-2">
                  <StandingsTable data={standings} highlightIds={[team.id]} showLegend />
                </div>
              </section>
            ) : (
              <div className="border border-border bg-white p-8 text-center text-sm text-muted">
                لا يتوفّر ترتيب لدوري هذا الفريق حالياً.
              </div>
            )}
          </main>

          <aside>
            <EntityListBlock
              title="البطولات"
              items={team.competitions.map((c) => ({
                id: c.id,
                name: c.name,
                image: c.logo,
                href: `/sport/competition/${c.id}`,
              }))}
            />
          </aside>
        </div>
      </Container>
    </div>
  );
}
