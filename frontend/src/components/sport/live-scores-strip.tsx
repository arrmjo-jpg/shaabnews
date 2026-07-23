import { LiveScoresStripCards } from '@/components/sport/live-scores-strip-cards';
import { getLiveScoresStripData } from '@/lib/sport/application/queries/getLiveScoresStripData';

// Live Scores Strip (Sprint 1.6 Phase 3، القرار المعماري في project_sport_header_footer_analysis):
// عنصر واجهة مستقلّ (Feature Component)، لا جزء من SportHeader — الهيدر يبقى Zero Data Fetch كما
// هو، هذا المكوّن يُقحَم فقط داخل صفحات Sport Home (sport-section.tsx)، لا في الـLayout ولا الهيدر.
//
// المصدر: SportDataProvider::getFeaturedMatches() (عبر application/queries، مطابقًا لـ§34) —
// ليس lib/sports-home-bar.ts (مُستبعَد بقرار: يُشابك مع اختيار News التحريري، ويكسر §34 لو استُهلِك
// هنا مباشرة). التحديث: ISR + Cache Tags (revalidate:60 داخل fetchAllScores) — **ليس Real-time**؛
// لا Polling ولا WebSocket. الاسم «Live» يصف نوع البيانات (مباريات مباشرة ضمنها)، لا آلية التحديث —
// آخر حالة معروفة ضمن دورة تحديث 60 ثانية، لا تحديثًا لحظيًّا أثناء بقاء الزائر على الصفحة.
const PROVIDER = '365scores';
const LIMIT = 8;

export async function LiveScoresStrip({
  sportId,
  date,
  priorityCompetitionIds,
}: {
  sportId: number;
  date: string;
  priorityCompetitionIds: number[];
}) {
  const matches = await getLiveScoresStripData(PROVIDER, sportId, date, LIMIT, priorityCompetitionIds);

  return <LiveScoresStripCards matches={matches} />;
}
