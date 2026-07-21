import Link from 'next/link';
import { Container } from '@/components/layout/container';

// Placeholder Sport header — Phase 2.2 Commit 1 (route-architecture only, per the approved ADR).
// Real Header 1 (branded, theme-independent dark bar) and Header 2 (theme-aware sport-type switcher)
// land in later, separately-reviewed commits on top of this same component. No theme, no logo, no
// Sport Menu, no search here — those are explicitly out of scope for this commit.
export function SportHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/sport" className="text-base font-bold text-fg">
          الرياضة
        </Link>
        <Link href="/" className="text-sm text-muted transition-colors hover:text-fg">
          الرئيسية
        </Link>
      </Container>
    </header>
  );
}
