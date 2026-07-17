import { ArrowRight, ExternalLink, PenLine } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container } from '@/components/layout/container';
import { getWriterProfile } from '@/lib/writer';

// صفحة بروفيل الكاتب العامّ — للكُتّاب المفعّلين فقط (الباك إند يبوّب بـ is_writer؛ غيره ⇒ 404).
// النبذة + روابط السوشيل + المعلومات. ISR = سقف أمان؛ التحديث حدثيّ عبر writers/writer:{id}
// (أكشنات تعديل المستخدم/حالته). خطّ الموقع، صفر تلفيق (لا بيانات ⇒ 404/حالة فارغة).
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — تأكَّد تجريبيًا أثناء ISR Restoration (راجع articles/[idslug]).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const writer = await getWriterProfile(Number(id));
  if (!writer) return { title: 'الكاتب غير موجود' };
  return { title: `${writer.name} — كاتب`, description: writer.bio ?? undefined };
}

export default async function WriterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const writer = await getWriterProfile(Number(id));
  if (!writer) notFound();

  const socials = Object.entries(writer.social).filter(([, url]) => typeof url === 'string' && url.trim());

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-2xl" dir="rtl">
        {/* رأس البروفيل: صورة + اسم + سوشيل */}
        <div className="flex flex-col items-center gap-5 border-b border-border pb-6 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-start">
          <div className="size-28 shrink-0 overflow-hidden bg-surface-2 ring-2 ring-border" style={{ borderRadius: '9999px' }}>
            {writer.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود
              <img src={writer.avatar} alt={writer.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-surface-3 text-muted" aria-hidden>
                <PenLine className="size-8" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <PenLine className="size-3.5" aria-hidden />
              كاتب
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-fg sm:text-3xl">{writer.name}</h1>

            {socials.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {socials.map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-primary hover:text-primary"
                    style={{ borderRadius: '9999px' }}
                  >
                    {platform}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* النبذة */}
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-muted">نبذة</h2>
          {writer.bio ? (
            <p className="whitespace-pre-line leading-relaxed text-fg">{writer.bio}</p>
          ) : (
            <p className="text-sm text-muted">لا توجد نبذة متاحة لهذا الكاتب.</p>
          )}
        </section>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1 text-sm font-bold text-primary transition-opacity hover:opacity-80"
        >
          <ArrowRight className="size-4 shrink-0" aria-hidden />
          العودة للرئيسية
        </Link>
      </div>
    </Container>
  );
}
