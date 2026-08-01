// هيكل تحميل (shimmer) لصفحة اللاعب — يحجز أبعاد الترويسة + التبويبات + المحتوى الرئيس/الشريط
// الجانبيّ بينما تنتظر `getPlayerPageData` استجابة 365Scores. نفس نمط `Box` المستخدَم في صفحة الفريق.
import { Container } from '@/components/layout/container';

function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function PlayerPageLoading() {
  return (
    <div className="bg-bg">
      <Container className="py-6">
        <Box className="mb-4 h-4 w-40" />

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <main className="flex min-w-0 flex-col gap-6">
            <div className="sport-card flex items-center gap-4 border border-border bg-surface p-5">
              <Box className="size-20 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Box className="h-5 w-1/3" />
                <Box className="h-3 w-1/5" />
              </div>
            </div>
            <Box className="h-10 w-full" />
            <Box className="h-40 w-full" />
            <Box className="h-32 w-full" />
          </main>
          <aside>
            <Box className="h-56 w-full" />
          </aside>
        </div>
      </Container>
    </div>
  );
}
