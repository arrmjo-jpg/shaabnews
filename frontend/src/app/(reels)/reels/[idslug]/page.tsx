import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UserAuthSlot } from '@/components/auth/user-auth-slot';
import { ReelsSocialRow } from '@/components/reels/reels-extras';
import { ReelsFeed, type ReelsNavItem } from '@/components/reels/reels-feed';
import { socialEntries } from '@/components/layout/social-map';
import { getReelByIdSlug, getReelsFeed } from '@/lib/reels';
import { REELS_PRIMARY, REELS_SERVICES } from '@/lib/reels-nav';
import { getSiteSettings } from '@/lib/site-settings';

// رابط عميق لريل محدّد — يفتح الـfeed مبتدئاً به. ISR = سقف أمان؛ التحديث حدثيّ عبر reel:{locale}:{slug}.
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — تأكَّد تجريبيًا أثناء ISR Restoration (راجع articles/[idslug]).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idslug: string }>;
}): Promise<Metadata> {
  const { idslug } = await params;
  const reel = await getReelByIdSlug(idslug);
  if (!reel) return { title: 'الريلز' };
  return {
    title: reel.title,
    description: reel.description ?? undefined,
    openGraph: {
      type: 'video.other',
      title: reel.title,
      description: reel.description ?? undefined,
      images: reel.poster ? [reel.poster] : undefined,
    },
  };
}

export default async function ReelDeepLinkPage({ params }: { params: Promise<{ idslug: string }> }) {
  const { idslug } = await params;
  const [reel, page, settings] = await Promise.all([
    getReelByIdSlug(idslug),
    getReelsFeed(),
    getSiteSettings(),
  ]);
  if (!reel) notFound();

  // الريل المطلوب أوّلاً ثمّ بقيّة الخلاصة (بلا تكرار).
  const items = [reel, ...page.items.filter((i) => i.id !== reel.id)];
  const navItems: ReelsNavItem[] = [
    ...REELS_PRIMARY.map((l) => ({ ...l, active: l.href === '/reels' })),
    ...REELS_SERVICES,
  ];
  // بطاقة الحساب معزولة عميليًّا (UserAuthSlot) بدل getCurrentUser() خادميّ — راجع ISR Restoration.
  const extras = (
    <>
      <UserAuthSlot variant="reels" />
      <ReelsSocialRow social={socialEntries(settings?.social)} />
    </>
  );

  return (
    <ReelsFeed
      initialItems={items}
      initialCursor={page.nextCursor}
      startId={reel.id}
      siteName={settings?.site_name || 'صدى الشعب الأخباري'}
      logo={settings?.logo_dark ?? settings?.logo_light ?? null}
      navItems={navItems}
      extrasSlot={extras}
    />
  );
}
