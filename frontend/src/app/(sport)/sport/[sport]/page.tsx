import { notFound, redirect } from 'next/navigation';

import { SportSection } from '@/components/sport/sport-section';
import { isValidYmd, todayAmman } from '@/lib/sport/day';
import { DEFAULT_SPORT, findSportBySlug } from '@/lib/sport/sports';

// /sport/{slug} — الرياضات غير الافتراضيّة (basketball/tennis/handball/volleyball). نفس `SportSection` بـsportId مختلف.
// slug غير معروف ⇒ 404؛ كرة القدم ⇒ تحويل للمسار القانونيّ /sport (لا تكرار محتوى).
export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const def = findSportBySlug(sport);
  return { title: def ? def.label : 'الرياضة' };
}

export default async function SportSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams: Promise<{ date?: string; live?: string }>;
}) {
  const { sport } = await params;
  const def = findSportBySlug(sport);
  if (!def) notFound();
  if (def.key === DEFAULT_SPORT.key) redirect('/sport');
  const sp = await searchParams;
  const today = todayAmman();
  const date = isValidYmd(sp.date) ? sp.date : today;
  return <SportSection sport={def} date={date} today={today} live={sp.live === '1'} />;
}
