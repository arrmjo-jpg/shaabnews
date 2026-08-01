// هيكل تحميل (shimmer) لصفحة المباراة — يحجز أبعاد الشريط الجانبيّ + الترويسة المتدرّجة + التبويبات
// بينما تنتظر `getMatchPageData` استجابة 365Scores. نفس نمط `Box` المستخدَم في صفحتَي الفريق واللاعب.
import { Container } from '@/components/layout/container';

function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function MatchPageLoading() {
  return (
    <div className="bg-bg">
      <Container className="py-6">
        <Box className="mb-4 h-4 w-56" />

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="min-w-0">
            <Box className="h-96 w-full" />
          </aside>

          <main className="flex min-w-0 flex-col gap-6">
            <Box className="h-48 w-full" />
            <Box className="h-10 w-full" />
            <Box className="h-64 w-full" />
          </main>
        </div>
      </Container>
    </div>
  );
}
