import Link from 'next/link';

import { getBreakingFeed } from '@/lib/feed';

import { Container } from './container';

// Breaking-news strip — sits directly under the header. Real is_breaking articles from the CMS
// (GET /feed/breaking); renders nothing when there's no breaking news (no placeholder fallback).
export async function BreakingBar() {
  const items = await getBreakingFeed();
  if (items.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface">
      <Container className="flex h-11 items-center gap-3">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-caption font-extrabold text-primary-foreground">
          <span className="size-1.5 rounded-full bg-primary-foreground motion-safe:animate-pulse" aria-hidden />
          عاجل
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex items-center gap-7 whitespace-nowrap text-sm font-medium text-fg">
            {items.map((item) => (
              <Link key={item.id} href={item.href} className="inline-flex shrink-0 items-center gap-2 hover:text-primary">
                <span className="size-1 rounded-full bg-primary" aria-hidden />
                {item.title}
              </Link>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 start-0 w-12 bg-gradient-to-r from-transparent to-surface" aria-hidden />
        </div>
      </Container>
    </div>
  );
}
