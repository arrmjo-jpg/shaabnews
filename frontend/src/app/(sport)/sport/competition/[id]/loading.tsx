// هيكل تحميل (shimmer) لصفحة البطولة — يحجز أبعاد الهيدر الداكن + الشريط الجانبيّ + المحتوى الرئيس
// بينما تنتظر `getCompetitionPageData` استجابة 365Scores. نفس نمط `Box` المستخدَم في صفحات الفريق/اللاعب/المباراة.
import { Container } from '@/components/layout/container';

function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function CompetitionPageLoading() {
  return (
    <div className="bg-bg">
      <Box className="h-[52px] w-full rounded-none bg-[#10181d]" />
      <Container className="py-6">
        <Box className="mb-4 h-4 w-40" />

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="min-w-0">
            <Box className="h-96 w-full" />
          </aside>

          <main className="min-w-0 space-y-6">
            <Box className="h-40 w-full" />
            <Box className="h-64 w-full" />
          </main>
        </div>
      </Container>
    </div>
  );
}
