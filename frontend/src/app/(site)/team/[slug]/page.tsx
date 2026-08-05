import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { Container } from '@/components/layout/container';
import { ReadingProgress } from '@/components/reading/reading-progress';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { TeamMemberProfile } from '@/components/team/team-member-profile';
import { env } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import { getTeamMemberOrRedirect } from '@/lib/team';

// صفحة تفاصيل عضو فريق — نفس تخطيط صفحة المحتوى النصّيّ/الكاتب تمامًا (Container + شريط تقدّم
// القراءة + مسار تنقّل + شبكة 12: محتوى 8 + جانب 4 = ودجت الأخبار المشترك بلا أي تعديل). العمود
// الرئيسيّ = TeamMemberProfile فقط (صورة/اسم/مسمّى/قسم/نبذة/تواصل) — بلا قائمة مقالات عمدًا،
// أعضاء الفريق ليسوا كتّابًا بالضرورة. SEO/JSON-LD (Person + BreadcrumbList) من الباك إند مباشرة
// (TeamMemberSeoBuilder) — بلا إعادة بناء هنا.
export const revalidate = 3600;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — نفس النمط المُثبَت تجريبياً بصفحة الكاتب idslug.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { member } = await getTeamMemberOrRedirect(decodeSlug(slug));
  if (!member) return { title: 'عضو الفريق غير موجود' };

  const base = await buildMetadata({
    title: member.seo.title,
    description: member.seo.description ?? undefined,
    path: member.seo.canonicalUrl,
    image: member.seo.image ?? undefined,
    keywords: member.seo.keywords
      ? member.seo.keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    type: 'article',
  });

  if (env.isProd && member.seo.robots) {
    return { ...base, robots: member.seo.robots };
  }
  return base;
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export default async function TeamMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { member, redirectTo } = await getTeamMemberOrRedirect(decodeSlug(slug));

  if (redirectTo) permanentRedirect(redirectTo);
  if (!member) notFound();

  const shareUrl = member.seo.canonicalUrl;

  const jsonLd = [member.seo.structuredData, member.seo.breadcrumbs]
    .filter((o): o is Record<string, unknown> => o !== null)
    .map((o) => JSON.stringify(o).replace(/</g, '\\u003c'));

  return (
    <Container className="py-6 sm:py-8">
      <ReadingProgress targetId="team-member-content" />

      <nav
        aria-label="مسار التنقّل"
        className="mb-4 flex flex-wrap items-center gap-2 text-caption text-muted print:hidden"
      >
        <Link href="/" className="shrink-0 transition-colors hover:text-primary">
          الرئيسية
        </Link>
        <span aria-hidden>/</span>
        <Link href="/team" className="shrink-0 transition-colors hover:text-primary">
          فريق العمل
        </Link>
        <span aria-hidden>/</span>
        <span className="line-clamp-1 text-fg">{member.name}</span>
      </nav>

      {/* نفس تخطيط المقال/الصفحة الثابتة: شبكة 12 (محتوى 8 + جانب 4). الجانب الأيسر = ودجت
          الأخبار المشترك، بلا أي تعديل. */}
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <main id="team-member-content" className="min-w-0 lg:col-span-8">
          <TeamMemberProfile member={member} shareUrl={shareUrl} />
        </main>
        <aside className="hidden lg:col-span-4 lg:block print:hidden">
          <ReadingSidebar />
        </aside>
      </div>

      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: j }} />
      ))}
    </Container>
  );
}
