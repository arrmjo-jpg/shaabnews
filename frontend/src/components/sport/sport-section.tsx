import { AdZone } from '@/components/ads/ad-zone';
import { Container } from '@/components/layout/container';
import { CountryAccordion } from '@/components/sport/country-accordion';
import { DayFilter } from '@/components/sport/day-filter';
import { EntityListBlock } from '@/components/sport/entity-list-block';
import { FeaturedSlider } from '@/components/sport/featured-slider';
import { LiveScoresStrip } from '@/components/sport/live-scores-strip';
import { SportMatchesSection } from '@/components/sport/matches-section';
import { SportNews } from '@/components/sport/sport-news';
import { StandingsBlock } from '@/components/sport/standings-block';
import { TopScorers } from '@/components/sport/top-scorers';
import { getCompetitions, getFeaturedMatches, getMatchesByCountry, getPopularTeams } from '@/lib/sport/games';
import { sportHref, type SportDef } from '@/lib/sport/sports';

// بطولة كأس العالم — يُستخدم لتصدير الهيرو (طلب المستخدم سابقاً). شريط نتائج كأس العالم نفسه
// (LeagueMatchesTicker) يظهر الآن في (site)/layout.tsx تحت الهيدر الرئيسيّ، على كلّ صفحات الموقع
// — لا يُكرَّر هنا.
const WORLD_CUP_COMPETITION_ID = 5930;
import { getTopScorers, TOP_SCORER_COMPETITIONS } from '@/lib/sport/stats';

// جسم قسم /sport المشترك (DRY) — يقوده sportId واحد؛ يُستعمل من `/sport` (كرة القدم) و`/sport/[sport]`.
// المنيو **ضمن الحاوية** أعلى المحتوى ← عمود ضيّق يمين (فلتر + مباريات + قوائم) + عريض يسار (سلايدر + أخبار).
export async function SportSection({
  sport,
  date,
  today,
  live = false,
}: {
  sport: SportDef;
  date: string;
  today: string;
  live?: boolean;
}) {
  const sid = sport.sportId;
  const basePath = sportHref(sport);
  // رابط يحافظ على التاريخ + حالة «مباشر» معاً (يحذف الافتراضيّ: اليوم/غير-مباشر).
  const q = (d: string, lv: boolean) => {
    const p = new URLSearchParams();
    if (d !== today) p.set('date', d);
    if (lv) p.set('live', '1');
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  // ويدجت الأهداف لكرة القدم فقط (هدّافون = بيانات كرة قدم)؛ غيرها ⇒ لا طلب (قائمة فارغة).
  const scorerIds = sid === 1 ? TOP_SCORER_COMPETITIONS : [];
  // الهيرو: مباريات كأس العالم (5930) في الصدارة لكرة القدم (طلب المستخدم).
  const featuredPriority = sid === 1 ? [WORLD_CUP_COMPETITION_ID] : [];
  const [featured, competitions, teams, countries, scorers] = await Promise.all([
    getFeaturedMatches(sid, date, 8, featuredPriority),
    getCompetitions(sid),
    getPopularTeams(sid),
    getMatchesByCountry(sid, date),
    getTopScorers(scorerIds),
  ]);

  return (
    <div className="bg-surface-2">
      <Container className="py-6">
        <LiveScoresStrip sportId={sid} date={date} priorityCompetitionIds={featuredPriority} />
        {/* إعلان عريض داخل صفحة «جدول الرياضة» — أسفل شريط النتائج المباشرة وفوق شبكة المحتوى،
            بعرض الحاوية كاملًا (1200px مطابق لعرض المساحة) لأن العمود الجانبيّ 340px لا يتّسع له.
            بلا إعلان ⇒ null بصفر مساحة (لا mt- على الغلاف، الهامش على العنصر نفسه). */}
        <AdZone zone="aalan_dakhl_qsm_jdwl_alryadaa" className="mt-6 flex justify-center" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <DayFilter selected={date} today={today} basePath={basePath} live={live} />
              <SportMatchesSection
                sportId={sid}
                date={date}
                live={live}
                liveHref={q(date, true)}
                timeHref={q(date, false)}
              />
            </div>
            <CountryAccordion countries={countries} />
          </aside>
          <main className="flex min-w-0 flex-col gap-6">
            <FeaturedSlider matches={featured} />
            {/* تحت الهيرو — نمط 365: ويدجت «الأهداف» عريض (يمين RTL) + إعلان أضيق (يسار، 240px
                مطابق لعرض المساحة) ⇒ التبويبات تتّسع بلا سكرول. flex لا grid عمدًا: بلا إعلان
                يعيد AdZone قيمة null فيمتدّ الويدجت للعرض كامل تلقائيًّا، بدل ترك عمود فارغ
                كما كان يفعل الـgrid ذو العمودين الثابتين. */}
            {scorers.length > 0 && (
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="min-w-0 lg:flex-1">
                  <TopScorers comps={scorers} />
                </div>
                <AdZone
                  zone="aalan_fy_alryada_mrba_kbyr"
                  className="flex justify-center lg:w-[240px] lg:shrink-0"
                />
              </div>
            )}
            <SportNews />
            {/* تحت الأخبار — ترتيب الدوري (نمط 365): كرة القدم فقط، الدوري السعودي (649) مثالاً */}
            {sid === 1 && <StandingsBlock competitionId={649} />}
            {/* نُقلت من العمود الجانبيّ (طلب المستخدم: أسفل ترتيب الدوري) — جنباً لجنب في العمود العريض */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <EntityListBlock
                title="البطولات الشائعة"
                items={competitions.map((c) => ({
                  id: c.id,
                  name: c.name,
                  image: c.logo,
                  sub: c.liveGames > 0 ? `${c.liveGames} مباشر` : c.totalGames > 0 ? String(c.totalGames) : null,
                  href: `/sport/competition/${c.id}`,
                }))}
              />
              <EntityListBlock
                title="الفرق الأكثر شهرة"
                items={teams.map((t) => ({ id: t.id, name: t.name, image: t.logo, color: t.color, href: `/sport/team/${t.id}` }))}
              />
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
