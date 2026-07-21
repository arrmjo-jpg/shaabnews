import type { Metadata } from 'next';

import { SportSection } from '@/components/sport/sport-section';
import { isValidYmd, todayAmman } from '@/lib/sport/day';
import { buildMetadata } from '@/lib/seo';
import { DEFAULT_SPORT } from '@/lib/sport/sports';

// /sport — الرياضة الافتراضيّة (كرة القدم) بلا بادئة. الجسم في `SportSection` المشترك (DRY). `?date=` يغيّر اليوم.
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'الرياضة',
    description: 'نتائج وجداول ومباريات كرة القدم والرياضة اليوم',
    path: '/sport',
    type: 'website',
  });
}

export default async function SportPage({ searchParams }: { searchParams: Promise<{ date?: string; live?: string }> }) {
  const sp = await searchParams;
  const today = todayAmman();
  const date = isValidYmd(sp.date) ? sp.date : today;
  return <SportSection sport={DEFAULT_SPORT} date={date} today={today} live={sp.live === '1'} />;
}
