import type { Metadata } from 'next';

import { UserAuthSlot } from '@/components/auth/user-auth-slot';
import { ReelsSocialRow } from '@/components/reels/reels-extras';
import { ReelsFeed, type ReelsNavItem } from '@/components/reels/reels-feed';
import { socialEntries } from '@/components/layout/social-map';
import { getReelsFeed } from '@/lib/reels';
import { REELS_PRIMARY, REELS_SERVICES } from '@/lib/reels-nav';
import { getSiteSettings } from '@/lib/site-settings';

// خلاصة الريلز الغامرة. ISR = سقف أمان فقط؛ التحديث حدثيّ عبر reel-feed:{locale}؛ التفاعل عميل.
export const revalidate = 36000;

export const metadata: Metadata = { title: 'الريلز' };

export default async function ReelsPage() {
  const [page, settings] = await Promise.all([getReelsFeed(), getSiteSettings()]);
  // درج الجوّال = نظير الشريط الجانبيّ: التنقّل الأساسيّ + الخدمات (بدل أقسام التصنيفات).
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
      initialItems={page.items}
      initialCursor={page.nextCursor}
      siteName={settings?.site_name || 'صدى الشعب الأخباري'}
      logo={settings?.logo_dark ?? settings?.logo_light ?? null}
      navItems={navItems}
      extrasSlot={extras}
    />
  );
}
