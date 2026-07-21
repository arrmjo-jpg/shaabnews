import { Container } from '@/components/layout/container';

// Phase 2.2 Commit 1 — group-root loading boundary, added in the same commit as the route-group
// move (mechanical parity requirement from the ADR). Only used by routes with no closer loading.tsx
// of their own (/sport, /sport/[sport], /sport/following) — the 4 detail pages keep their own
// dedicated skeletons from Phase 1.4 Step 2 unchanged, which take precedence over this one.
function Box({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 ${className}`} aria-hidden />;
}

export default function SportGroupLoading() {
  return (
    <Container className="py-6">
      <Box className="h-64 w-full" />
    </Container>
  );
}
