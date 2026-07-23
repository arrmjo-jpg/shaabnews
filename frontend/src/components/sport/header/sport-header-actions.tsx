import { SportAccountSlot } from '@/components/sport/header/sport-account-slot';
import { SportHeaderSearch } from '@/components/sport/header/sport-header-search';
import { SportNotificationsSlot } from '@/components/sport/header/sport-notifications-slot';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط `allow_theme_switch` فقط) + Phase 3 (Notifications/User
// Menu، Commit 1+2؛ Search — project_sport_header_footer_analysis): المظهر يبقى زرًّا ثابتًا
// `disabled` (خارج النطاق، ينتظر دوره الخاص — قرار معماريّ: يُشحَن كقوس واحد كامل لاحقًا، لا قطعة
// تجميليّة الآن). البحث والحساب والإشعارات أصبحوا تفاعليّين فعليًّا — الثلاثة يستهلكون نفس
// الـUnified Entry Point المشترك أو مسارًا عامًّا صرفًا (SportDataProvider)، لا منطق جلسة/Fetch جديد
// داخل أيٍّ منها هنا.
export function SportHeaderActions({ allowThemeSwitch }: { allowThemeSwitch: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <SportHeaderSearch />
      {allowThemeSwitch && (
        <button
          type="button"
          disabled
          aria-label="تبديل المظهر (قريبًا)"
          className="flex size-9 items-center justify-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className="block size-4 rounded-full border border-current"
            style={{ backgroundImage: 'linear-gradient(90deg, currentColor 50%, transparent 50%)' }}
            aria-hidden
          />
        </button>
      )}
      <SportNotificationsSlot />
      <SportAccountSlot />
    </div>
  );
}
