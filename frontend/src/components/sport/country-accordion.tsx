'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { FollowButton } from '@/components/sport/follow-button';
import { MatchRow } from '@/components/sport/match-row';
import type { CountryMatchGroup } from '@/lib/sport/games';

// كتلة «الدول» منسدلة (أكورديون، نمط 365) — نقر الدولة يفتح بطولاتها ومبارياتها (صفوف روابط لصفحة التفاصيل).
// واحدة مفتوحة في كلّ مرّة. مربّع؛ الأعلام كما هي (contain). يتبع التاريخ المختار. لا تلفيق: دولة بلا مباريات لا تظهر.
export function CountryAccordion({ countries }: { countries: CountryMatchGroup[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (!countries.length) return null;

  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-extrabold text-fg">الدول</h3>
      </div>
      <ul>
        {countries.map((c) => {
          const isOpen = openId === c.id;
          return (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : c.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-surface-2"
              >
                {c.flag ? (
                  // eslint-disable-next-line @next/next/no-img-element -- علم الدولة من CDN 365
                  <img src={c.flag} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
                ) : (
                  <span className="size-6 shrink-0" aria-hidden />
                )}
                <span className="line-clamp-1 flex-1 text-sm font-bold text-fg">{c.name}</span>
                {c.liveCount > 0 && <span className="shrink-0 text-[11px] font-bold text-primary">{c.liveCount} مباشر</span>}
                <span className="shrink-0 text-[11px] font-bold text-muted tabular-nums">{c.gameCount}</span>
                <ChevronDown
                  className={'size-4 shrink-0 text-muted transition-transform duration-200 ' + (isOpen ? 'rotate-180' : '')}
                  aria-hidden
                />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {c.competitions.map((comp) => (
                    <div key={comp.id} className="border-b border-border last:border-b-0">
                      <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5">
                        <Link
                          href={`/sport/competition/${comp.id}`}
                          className="flex min-w-0 flex-1 items-center gap-2 transition-colors hover:text-primary"
                        >
                          {comp.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
                            <img src={comp.logo} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
                          ) : null}
                          <span className="truncate text-[12px] font-medium text-fg">{comp.name || '—'}</span>
                          <ChevronLeft className="ms-auto size-3.5 shrink-0 text-muted" aria-hidden />
                        </Link>
                        <FollowButton type="competition" id={comp.id} bare />
                      </div>
                      {comp.matches.map((m) => (
                        <MatchRow key={m.id} match={m} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
