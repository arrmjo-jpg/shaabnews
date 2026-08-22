import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { WriterArticlesFeed } from '@/components/articles/writer-articles-feed';
import { WriterProfileHeader } from '@/components/articles/writer-profile-header';
import { Container } from '@/components/layout/container';
import { SubscribeBox } from '@/components/public-forms/subscribe-box';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { env } from '@/lib/env';
import { getWriterArticles, getWriterProfile, type WriterProfile } from '@/lib/writer';

const PER_PAGE = 18;

// صفحة بروفيل الكاتب العامّ — للكُتّاب المفعّلين فقط (الباك إند يبوّب بـ is_writer؛ غيره ⇒ 404).
// الرابط القانونيّ id-slug (`/news/writer/{id}-{slug}`، قرار موثَّق في
// docs/roadmap/AUTHOR-PROFILE-PAGE-ANALYSIS.md §5) — بعكس المقال الذي أسقط السلَغ من شكله القانونيّ،
// هنا السلَغ جزء من القانونيّ نفسه، لكنه لا يزال زخرفياً بحتاً (id هو مفتاح الجلب دوماً)، فمُعرَّف
// غير مطابق (id فقط، أو سلَغ قديم بعد تغيير الاسم) لا يكسر الرابط — تحويل 301 لتصحيحه، تماماً
// كصفحة المقال (news/[dd]/[mm]/[yyyy]/[idslug]). السلَغ نفسه مصدر حقيقة واحد بالباك إند
// (User::getSlugAttribute) — الواجهة لا تحسبه أبداً، فقط تُنسِّق الرابط من القيمة الجاهزة.
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — نفس النمط المُثبَت تجريبياً بصفحة المقال idslug.
export async function generateStaticParams() {
  return [];
}

async function resolveCanonical(rawIdslug: string): Promise<{
  writer: WriterProfile | null;
  isCanonical: boolean;
  target: string | null;
}> {
  // فكّ الترميز مرّة واحدة — يُستخدم لكلّ من استخراج الـid ومقارنة القانونيّة (سلَغ عربيّ خام
  // بمقارنة idslug كما وصل من Next مباشرة، بدل فكّه، كان يفشل دوماً ⇒ حلقة تحويل لا نهائية،
  // ثابتة تجريبياً على هذه الصفحة قبل هذا الإصلاح).
  let idslug = rawIdslug;
  try {
    idslug = decodeURIComponent(rawIdslug);
  } catch {
    /* مقطع غير صالح الترميز — نُبقي الخام */
  }
  const id = idslug.replace(/^(\d+).*$/, '$1');
  if (!/^\d+$/.test(id)) return { writer: null, isCanonical: false, target: null };

  const writer = await getWriterProfile(Number(id));
  if (!writer) return { writer: null, isCanonical: false, target: null };

  const isCanonical = idslug === `${writer.id}-${writer.slug}`;
  // encodeURIComponent إلزاميّ على مقطع السلَغ — سلَغ عربيّ خام بترويسة Location يُسقِط الخادم
  // (نفس القاعدة الموثَّقة بـ(site)/category/[slug]/page.tsx).
  const target = `/news/writer/${writer.id}-${encodeURIComponent(writer.slug)}`;

  return { writer, isCanonical, target };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idslug: string }>;
}): Promise<Metadata> {
  const { idslug } = await params;
  const { writer } = await resolveCanonical(idslug);
  if (!writer) return { title: 'الكاتب غير موجود' };
  return { title: `${writer.name} — كاتب`, description: writer.bio ?? undefined };
}

export default async function WriterProfilePage({ params }: { params: Promise<{ idslug: string }> }) {
  const { idslug } = await params;
  const resolved = await resolveCanonical(idslug);
  if (!resolved.writer) notFound(); // 404 حقيقيّ — id غير موجود إطلاقاً، لا شكل رابط بديل يُنقذه

  if (!resolved.isCanonical) {
    permanentRedirect(resolved.target as string);
  }

  const writer = resolved.writer;
  const shareUrl = `${env.siteUrl}${resolved.target}`;
  const articles = await getWriterArticles(writer.id, 1, PER_PAGE);

  return (
    <div className="w-full">
      <WriterProfileHeader writer={writer} shareUrl={shareUrl} />

      <Container className="py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <main className="min-w-0 lg:col-span-8">
            {articles.total === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
                style={{ borderRadius: '12px' }}
              >
                <h2 className="font-heading text-h3 font-bold text-fg">لا توجد مقالات لهذا الكاتب بعد</h2>
                <p className="max-w-md text-sm text-muted">ستظهر هنا مقالات «{writer.name}» فور نشرها.</p>
              </div>
            ) : (
              <WriterArticlesFeed
                writerId={writer.id}
                initialItems={articles.items}
                initialPage={articles.page}
                initialTotalPages={articles.totalPages}
              />
            )}
          </main>
          <aside className="hidden lg:col-span-4 lg:block space-y-6">
            <ReadingSidebar />
            <SubscribeBox variant="card" />
          </aside>
        </div>
      </Container>
    </div>
  );
}
