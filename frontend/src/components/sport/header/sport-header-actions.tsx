import { SearchIcon } from '@/components/icons';
import { SportAccountSlot } from '@/components/sport/header/sport-account-slot';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط `allow_theme_switch` فقط) + Phase 3 (Notifications/User
// Menu، Commit 1 — project_sport_header_footer_analysis): البحث والمظهر يبقيان أزرارًا ثابتة
// `disabled` (خارج نطاق هذا الـCommit، ينتظران دورهما الخاص). الحساب أصبح تفاعليًّا فعليًّا —
// SportAccountSlot يستهلك الـUnified Entry Point المشترك، لا منطق جلسة جديد هنا.
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
      <SportAccountSlot />
    </div>
  );
}
