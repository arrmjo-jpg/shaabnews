// هيكل تحميل (shimmer) لصفحة الفريق — يحجز نفس أبعاد الترويسة + شبكة الترتيب/البطولات
// (لا قفز تخطيط) بينما تنتظر `getTeamPageData` استجابة 365Scores. نمط `Box` مطابق لـ
// `video-skeletons.tsx` (الوحيد الذي يقدّم هذا النمط اليوم في الواجهة العامّة).
import { Container } from '@/components/layout/container';

function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function TeamPageLoading() {
  return (
    <div className="bg-surface-2">
      <Container className="py-6">
        <Box className="mb-4 h-4 w-40" />

        <div className="mb-6 flex items-center gap-3">
          <Box className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Box className="h-5 w-1/3" />
            <Box className="h-3 w-1/5" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <main className="min-w-0">
            <Box className="h-64 w-full" />
          </main>
          <aside>
            <Box className="h-48 w-full" />
          </aside>
        </div>
      </Container>
    </div>
  );
}
