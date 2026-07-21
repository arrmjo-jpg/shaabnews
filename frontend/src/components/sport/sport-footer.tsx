import { Container } from '@/components/layout/container';

// Placeholder Sport footer — Phase 2.2 Commit 1 (route-architecture only, per the approved ADR).
// Real footer content is explicitly paused pending its own design decision (Phase 2.3) — do not
// add real links, branding, or settings-driven content here until that decision lands.
export function SportFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-6 text-center text-sm text-muted">قسم الرياضة</Container>
    </footer>
  );
}
