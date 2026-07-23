import { SearchIcon } from '@/components/icons';
import { SportAccountSlot } from '@/components/sport/header/sport-account-slot';
import { SportNotificationsSlot } from '@/components/sport/header/sport-notifications-slot';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط `allow_theme_switch` فقط) + Phase 3 (Notifications/User
// Menu، Commit 1+2 — project_sport_header_footer_analysis): البحث والمظهر يبقيان أزرارًا ثابتة
// `disabled` (خارج نطاق هذين الـCommit، ينتظران دورهما الخاص). الحساب والإشعارات أصبحا
// تفاعليَّين فعليًّا — كلاهما يستهلك نفس الـUnified Entry Point المشترك (useAuthSession)، لا
// منطق جلسة/Fetch جديد في أيّ منهما.
export function SportHeaderActions({ allowThemeSwitch }: { allowThemeSwitch: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled
        aria-label="البحث (قريبًا)"
        className="flex size-9 items-center justify-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SearchIcon className="size-[18px]" aria-hidden />
      </button>
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
