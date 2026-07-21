import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { EntityListBlock } from '@/components/sport/entity-list-block';
import { FollowButton } from '@/components/sport/follow-button';
import { SportBreadcrumb } from '@/components/sport/sport-breadcrumb';
import { StandingsTable } from '@/components/sport/standings-table';
import { env } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import { getTeamPageData } from '@/lib/sport/application/queries/getTeamPageData';

// صفحة الفريق `/sport/team/[id]` (مثل 365 `/team/{id}`) — ترويسة + ترتيب دوريه الرئيس (صفّ الفريق مُميَّز) + بطولاته
// (روابط لصفحة البطولة). لا fixtures (نقطة مباريات الفريق لا تعمل) ⇒ لا تلفيق. الثابت «team» يسبق `[sport]`.
// Phase 1.4 Step 2 — أوّل صفحة عرض تُبنى: تستورد حصريًّا من `application/queries/*` (لا `stats.ts`
// ولا `infrastructure/*` مباشرة)، طبقًا لـ §34. مزوّد واحد مسجَّل اليوم فقط، فالسلسلة الحرفية هنا
// مقبولة (لا تجريد سابق لأوانه لمزوّد ثانٍ غير موجود).
const PROVIDER = '365scores';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return buildMetadata({ title: 'الفريق', path: `/sport/team/${id}` });
  const { data } = await getTeamPageData(PROVIDER, tid);
  const team = data.profile;
  if (!team) return buildMetadata({ title: 'الفريق', path: `/sport/team/${tid}` });

  return buildMetadata({
    title: team.name,
    description: `ترتيب وبطولات فريق ${team.name}`,
    path: `/sport/team/${tid}`,
    image: team.logo ?? undefined,
    type: 'website',
  });
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) notFound();
  const { data } = await getTeamPageData(PROVIDER, tid);
  const team = data.profile;
  if (!team) notFound();
  const standings = data.standings;

  const siteUrl = env.siteUrl || '';
  const teamJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    url: `${siteUrl}/sport/team/${tid}`,
    ...(team.logo ? { logo: team.logo } : {}),
  };

  return (
    <div className="bg-surface-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }} />
      <Container className="py-6">
        <SportBreadcrumb items={[{ name: team.name }]} />

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
