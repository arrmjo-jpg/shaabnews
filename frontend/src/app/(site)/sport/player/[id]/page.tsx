import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { FollowButton } from '@/components/sport/follow-button';
import { PlayerStats } from '@/components/sport/player-stats';
import { PlayerCareer, PlayerLastMatches, PlayerTrophies } from '@/components/sport/player-widgets';
import { buildMetadata } from '@/lib/seo';
import {
  getPlayer,
  getPlayerCareerData,
  getPlayerLastMatches,
  getPlayerStats,
  getPlayerTrophies,
  getTeamSquad,
  type PlayerTeam,
  type SquadPlayer,
} from '@/lib/sport/player';

// صفحة اللاعب `/sport/player/[id]` (نمط 365 athlete) — ترويسة (صورة/اسم/مركز/نبذة) + ٣ تبويبات: ملف اللاعب /
// المباريات / الإحصائيات (محفوظة دائماً) + شريط جانبيّ «قد تكون مهتمًا بـ». كلّ البيانات من نقاط 365 الداخليّة
// المكتشفة (athletes/games·career·trophies/stats·squads·stats) — مفحوصة حيًّا، بلا تلفيق. المسار «player» ثابت.
const TABS = [
  { id: 'profile', label: 'ملف اللاعب' },
  { id: 'matches', label: 'المباريات' },
  { id: 'stats', label: 'الإحصائيات' },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return buildMetadata({ title: 'اللاعب', path: `/sport/player/${id}` });
  const p = await getPlayer(pid);
  if (!p) return buildMetadata({ title: 'اللاعب', path: `/sport/player/${pid}` });

  return buildMetadata({
    title: p.name,
    description: `ملف وإحصائيات اللاعب ${p.name}`,
    path: `/sport/player/${pid}`,
    type: 'website',
  });
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; competitionId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const p = await getPlayer(pid);
  if (!p) notFound();

  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : 'profile';
  const compId = Number(sp.competitionId) || p.competitions[0]?.id || null;
  const squadTeamId = p.club?.id ?? p.nationalTeam?.id ?? null;
  const needProfile = tab === 'profile';
  const needMatches = tab === 'profile' || tab === 'matches';

  const [stats, lastMatches, squad, career] = await Promise.all([
    (needProfile || tab === 'stats') && compId ? getPlayerStats(pid, compId) : Promise.resolve([]),
    needMatches ? getPlayerLastMatches(pid, tab === 'matches' ? 20 : 5) : Promise.resolve([]),
    squadTeamId ? getTeamSquad(squadTeamId) : Promise.resolve([]),
    needProfile ? getPlayerCareerData(pid) : Promise.resolve({ sections: [], competitions: [] }),
  ]);
  // اللاعب نفسه ضمن تشكيلة ناديه ⇒ منه الطول/القميص/الميلاد (غير المتوفّرة في نقطة اللاعب)؛ والبقيّة زملاؤه.
  const self = squad.find((s) => s.id === pid) ?? null;
  const teammates = squad.filter((s) => s.id !== pid);
  // الألقاب: تُستعلَم لكلّ بطولات مسيرته (مكتشَفة من مسح ١٠ مواسم) ⇒ تشمل بطولات قديمة فاز بها خارج موسمه الحاليّ.
  const trophies = needProfile ? await getPlayerTrophies(pid, career.competitions) : [];

  const bio = buildBio(p);
  const statsHref = `/sport/player/${pid}?tab=${tab}`;

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

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <main className="flex min-w-0 flex-col gap-6">
            {/* الترويسة */}
            <section dir="rtl" className="border border-border bg-white">
              <div className="flex items-center gap-4 p-5">
                <span className="avatar flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                    <img src={p.photo} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="text-2xl font-extrabold text-muted">{(p.name || '?').slice(0, 1)}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-extrabold text-fg sm:text-2xl">{p.name}</h1>
                  {p.position && <p className="mt-1 text-sm font-bold text-primary">{p.position}</p>}
                </div>
                <FollowButton type="player" id={pid} className="ms-auto self-center" />
              </div>
              {bio && <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-muted">{bio}</p>}
            </section>

            {/* التبويبات (محفوظة دائماً) */}
            <div dir="rtl" className="flex border-b border-border">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={`/sport/player/${pid}?tab=${t.id}`}
                  aria-current={tab === t.id ? 'true' : undefined}
                  className={
                    'border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ' +
                    (tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg')
                  }
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {tab === 'matches' ? (
              <PlayerLastMatches matches={lastMatches} />
            ) : tab === 'stats' ? (
              <PlayerStats competitions={p.competitions} activeId={compId} stats={stats} baseHref={statsHref} />
            ) : (
              <>
                <PlayerInfoCard
                  nationalTeam={p.nationalTeam}
                  club={p.club}
                  age={p.age}
                  nationality={p.nationality}
                  height={self?.height ?? null}
                  jersey={self?.jersey ?? null}
                  birthdate={self?.birthdate ?? null}
                />
                <PlayerStats competitions={p.competitions} activeId={compId} stats={stats} baseHref={statsHref} />
                <PlayerLastMatches matches={lastMatches} moreHref={`/sport/player/${pid}?tab=matches`} />
                <PlayerCareer sections={career.sections} />
                <PlayerTrophies groups={trophies} />
              </>
            )}
          </main>

          <RelatedSidebar teammates={teammates} teams={p.teams} />
        </div>
      </Container>
    </div>
  );
}

function buildBio(p: { name: string; nationality: string | null; age: number | null; club: PlayerTeam | null }): string {
  const who = [p.nationality, p.age != null ? `${p.age} سنة` : null].filter(Boolean).join('، ');
  const head = who ? `${p.name} (${who})` : p.name;
  return `${head} لاعب كرة قدم${p.club ? `، يلعب حاليّاً لصالح ${p.club.name}` : ''}.`;
}

function PlayerInfoCard({
  nationalTeam,
  club,
  age,
  nationality,
  height,
  jersey,
  birthdate,
}: {
  nationalTeam: PlayerTeam | null;
  club: PlayerTeam | null;
  age: number | null;
  nationality: string | null;
  height: number | null;
  jersey: number | null;
  birthdate: string | null;
}) {
  const teamCards: { team: PlayerTeam; role: string }[] = [];
  if (nationalTeam) teamCards.push({ team: nationalTeam, role: 'المنتخب' });
  if (club) teamCards.push({ team: club, role: 'النادي' });

  const facts: { value: string; label: string }[] = [];
  if (age != null) facts.push({ value: `${age} سنة`, label: birthdate ? formatDob(birthdate) : 'العمر' });
  if (height != null) facts.push({ value: (height / 100).toFixed(2), label: 'الطول (م)' });
  if (jersey != null) facts.push({ value: String(jersey), label: 'الرقم' });
  if (nationality) facts.push({ value: nationality, label: 'الجنسية' });

  return (
    <section dir="rtl" className="border border-border bg-white">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">معلومات اللاعب</h2>
      </div>
      {teamCards.length > 0 && (
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {teamCards.map(({ team, role }) => (
            <Link
              key={team.id}
              href={`/sport/team/${team.id}`}
              className="flex items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-surface-2"
            >
              {team.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
                <img src={team.logo} alt="" loading="lazy" className="size-10 shrink-0 object-contain" />
              ) : (
                <span className="size-10 shrink-0 bg-surface-2" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-fg">{team.name}</span>
                <span className="block text-[11px] text-muted">{role}</span>
              </span>
              <ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden />
            </Link>
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-0.5 bg-white px-2 py-3 text-center">
              <dd className="order-1 text-base font-extrabold text-fg">{f.value}</dd>
              <dt className="order-2 text-[11px] text-muted">{f.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function formatDob(iso: string): string {
  const ymd = iso.slice(0, 10).split('-');
  if (ymd.length !== 3) return '';
  const [y, m, d] = ymd;
  return `${d}/${m}/${y.slice(2)}`;
}

function RelatedSidebar({ teammates, teams }: { teammates: SquadPlayer[]; teams: PlayerTeam[] }) {
  // «قد تكون مهتمًا بـ» = **لاعبون** (زملاء الفريق، طلب صريح) ثمّ فرقه — لا دوريات.
  const items = [
    ...teammates.slice(0, 12).map((t) => ({ key: `p${t.id}`, href: `/sport/player/${t.id}`, name: t.name, logo: t.photo, sub: t.position, round: true })),
    ...teams.map((t) => ({ key: `t${t.id}`, href: `/sport/team/${t.id}`, name: t.name, logo: t.logo, sub: 'فريق', round: false })),
  ];
  if (items.length === 0) return <aside className="hidden lg:block" />;

  return (
    <aside dir="rtl" className="min-w-0">
      <section className="border border-border bg-white lg:sticky lg:top-24">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-extrabold text-fg">قد تكون مهتمًا بـ</h2>
        </div>
        <ul>
          {items.map((it) => (
            <li key={it.key}>
              <Link
                href={it.href}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <span
                  className={
                    'flex size-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2 ' +
                    (it.round ? 'avatar rounded-full' : '')
                  }
                >
                  {it.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- صورة 365 من CDN
                    <img src={it.logo} alt="" loading="lazy" className={it.round ? 'size-full object-cover' : 'size-7 object-contain'} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-fg">{it.name}</span>
                  {it.sub && <span className="block truncate text-[11px] text-muted">{it.sub}</span>}
                </span>
                <ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
