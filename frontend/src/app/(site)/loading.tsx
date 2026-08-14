import { Container } from '@/components/layout/container';

// حدّ تحميل على جذر مجموعة (site) — كان غائبًا كليًّا عن هذه المجموعة بينما (sport) تملكه منذ
// Phase 2.2. بلا هذا الملف، App Router يُبقي الصفحة القديمة معروضة كما هي حتى تجهز الوجهة، فيبدو
// الموقع متجمّدًا أثناء التنقّل. قِيس حيًّا (2026-08-14) على مسارات باردة: 2.13s لصفحة مقال و2.78s
// لصفحة قسم — تجمّد كامل بلا أي مؤشّر. المسارات المُكاشة (0.18-0.37s) لا تكاد تُظهره.
//
// النطاق: يغطّي كل مسارات (site) التي لا تملك loading.tsx أقرب منها — الرئيسية والأقسام والمقالات
// و/latest و/economy وغيرها. الـchrome (الهيدر/الأقسام/الفوتر) يبقى ظاهرًا لأنه في layout.tsx خارج
// هذا الحدّ؛ يُستبدَل محتوى <main> وحده.
//
// نفس نمط Box المستخدَم في هياكل (sport) — لا مكوّن جديد ولا نظام تقدّم موازٍ.
function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function SiteLoading() {
  return (
    <Container className="py-6 sm:py-8">
      <div role="status" aria-live="polite">
        <span className="sr-only">جارٍ تحميل الصفحة…</span>

        {/* ترويسة القسم/المقال */}
        <Box className="h-8 w-2/3 sm:h-9 sm:w-1/2" />
        <Box className="mt-3 h-4 w-1/3" />

        {/* كتلة رئيسية + قائمة — يقارب تخطيط أغلب صفحات الموقع (قسم/مقال/تغذية) */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Box className="aspect-[16/9] w-full" />
            <Box className="mt-4 h-6 w-5/6" />
            <Box className="mt-2 h-4 w-full" />
            <Box className="mt-2 h-4 w-4/5" />
          </div>

          <ul className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-start gap-3">
                <Box className="h-[70px] w-[110px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <Box className="h-4 w-full" />
                  <Box className="mt-2 h-4 w-2/3" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}
