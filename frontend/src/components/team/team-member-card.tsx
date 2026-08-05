import Link from 'next/link';
import { User } from 'lucide-react';

import type { TeamMemberCard as TeamMemberCardData } from '@/lib/team';

// بطاقة عضو فريق خفيفة (قائمة /team) — صورة دائريّة + اسم + مسمّى وظيفيّ. رابط كامل البطاقة.
export function TeamMemberCard({ member }: { member: TeamMemberCardData }) {
  return (
    <Link
      href={member.href}
      className="group flex flex-col items-center gap-3 p-4 text-center transition-colors hover:bg-surface-2"
    >
      <div
        className="size-24 shrink-0 overflow-hidden bg-surface-2 ring-1 ring-border transition-transform duration-300 group-hover:scale-105"
        style={{ borderRadius: '9999px' }}
      >
        {member.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود (اتّساق مع بطاقات الهوم)
          <img
            src={member.avatar.thumb ?? member.avatar.url}
            alt={member.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-3 text-muted" aria-hidden>
            <User className="size-10" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-1 font-bold text-fg transition-colors group-hover:text-primary">{member.name}</h3>
        {member.jobTitle && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{member.jobTitle}</p>}
      </div>
    </Link>
  );
}
