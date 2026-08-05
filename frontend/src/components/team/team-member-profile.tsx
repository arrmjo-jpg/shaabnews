import { User } from 'lucide-react';

import { socialEntries } from '@/components/layout/social-map';
import { ShareButtons } from '@/components/share/share-buttons';
import type { TeamMemberDetail } from '@/lib/team';

// محتوى صفحة عضو الفريق (العمود الرئيسيّ) — صورة + اسم + مسمّى وظيفيّ + قسم + روابط تواصل +
// مشاركة، ثم نبذة تعريفية كاملة (HTML مُعقَّم خادميًّا، .tiptap-content نفس نمط الصفحات الثابتة).
// بلا قائمة مقالات عمدًا — أعضاء الفريق ليسوا كتّابًا بالضرورة (بعكس WriterProfileHeader).
export function TeamMemberProfile({ member, shareUrl }: { member: TeamMemberDetail; shareUrl: string }) {
  const socials = socialEntries(member.social);
  const titleLine = [member.jobTitle, member.department].filter(Boolean).join(' · ');

  return (
    <article dir="rtl">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-start">
        <div
          className="size-28 shrink-0 overflow-hidden bg-surface-2 ring-2 ring-border sm:size-32"
          style={{ borderRadius: '9999px' }}
        >
          {member.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود
            <img
              src={member.avatar.medium ?? member.avatar.url}
              alt={member.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-surface-3 text-muted" aria-hidden>
              <User className="size-10" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-fg sm:text-3xl">{member.name}</h1>
          {titleLine && <p className="mt-1.5 text-base font-bold text-primary">{titleLine}</p>}

          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {socials.map(({ key, url, Icon, label }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={label}
                  title={label}
                  className="inline-flex size-9 items-center justify-center bg-surface-2 text-fg transition-colors hover:bg-surface-3 hover:text-primary"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-center sm:justify-start">
            <ShareButtons url={shareUrl} title={member.name} />
          </div>
        </div>
      </div>

      {member.bioHtml && (
        <div
          className="tiptap-content mt-8 text-[1.0625rem] leading-loose text-fg"
          dangerouslySetInnerHTML={{ __html: member.bioHtml }}
        />
      )}
    </article>
  );
}
