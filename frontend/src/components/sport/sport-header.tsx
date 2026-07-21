import { Container } from '@/components/layout/container';
import { SportHeaderActions } from '@/components/sport/header/sport-header-actions';
import { SportLogoPlaceholder } from '@/components/sport/header/sport-logo-placeholder';
import { SportPrimaryNav } from '@/components/sport/header/sport-primary-nav';

// Phase 2.2 Commit 2 — الهيكل النهائيّ لـ Header 1 (نمط الأساس المعتمد): شعار · تنقّل أساسيّ ·
// أقسام (مكانها فقط) · بحث/مظهر (بنية فقط). بلا أي Data Fetch أو Settings أو Menu Items أو حالة —
// كلّها تُربط في Commits لاحقة منفصلة (3: Public Sport Settings، 4: Sport Menu، ...). لا رابط
// «اللغة» هنا عمدًا — قرار سابق: تُخفى الأيقونة كليًّا حتى يُحسَم /sport/en، لا Placeholder معطَّل.
// مقسَّم إلى مكوّنات فرعية تحت header/* حتى تلمس كلّ مرحلة لاحقة ملفًّا واحدًا فقط دون إعادة لمس
// هذا التركيب.
export function SportHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-6">
          <SportLogoPlaceholder />
          <SportPrimaryNav />
        </div>
        <SportHeaderActions />
      </Container>
    </header>
  );
}
