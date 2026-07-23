import { SportAccountSlot } from '@/components/sport/header/sport-account-slot';
import { SportHeaderSearch } from '@/components/sport/header/sport-header-search';
import { SportNotificationsSlot } from '@/components/sport/header/sport-notifications-slot';
import { SportThemeToggle } from '@/components/sport/header/sport-theme-toggle';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط `allow_theme_switch` فقط) + Phase 3 (Notifications/User
// Menu، Commit 1+2؛ Search — project_sport_header_footer_analysis) + Sprint 1.7 Phase T3 (المظهر
// أصبح زرًّا حقيقيًّا، SportThemeToggle). البحث والحساب والإشعارات والمظهر أربعتهم تفاعليّون
// فعليًّا الآن — كلّ واحد مستقلّ (لا Context مشترك)، لا منطق جلسة/Fetch جديد داخل أيٍّ منها هنا.
export function SportHeaderActions({
  allowThemeSwitch,
  themeCookieName,
}: {
  allowThemeSwitch: boolean;
  themeCookieName: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <SportHeaderSearch />
      {allowThemeSwitch && <SportThemeToggle cookieName={themeCookieName} />}
      <SportNotificationsSlot />
      <SportAccountSlot />
    </div>
  );
}
