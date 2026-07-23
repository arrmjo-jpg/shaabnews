import type { Metadata } from 'next';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { SearchIcon } from '@/components/icons';
import { getSportSearchResults } from '@/lib/sport/application/queries/getSportSearchResults';
import type { SearchCompetitionHit, SearchPlayerHit, SearchTeamHit } from '@/lib/sport/domain/entities';

// صفحة نتائج بحث الرياضة (Sprint 1.6 Phase 3) — تقرأ `?q=` (يرسلها SportHeaderSearch) وتستدعي
// getSportSearchResults عبر application/queries/* فقط (§34). بطولات/فرق/لاعبون فقط — كل نتيجة
// تربط بصفحتها الداخلية القانونية الموجودة فعلًا (/sport/competition|team|player/{id})، لا نتيجة
// بلا وجهة داخلية (القاعدة المعماريّة المُقفَلة). noindex — نفس سياسة /news/search.
const PROVIDER = '365scores';

export const metadata: Metadata = {
  title: 'بحث الرياضة',
  robots: { index: false, follow: true },
};

function ResultSection<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section dir="rtl" className="mb-6 border border-border bg-white">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">{title}</h2>
      </div>
      <ul>{items.map(renderItem)}</ul>
    </section>
  );
}

function ResultRow({ href, logo, name, sub }: { href: string; logo: string | null; name: string; sub?: string | null }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة 365 من CDN
            <img src={logo} alt="" loading="lazy" className="size-7 object-contain" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-fg">{name}</span>
          {sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function SportSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : '').trim();

  const results = q
    ? await getSportSearchResults(PROVIDER, q)
    : { competitions: [], teams: [], players: [] };

  const total = results.competitions.length + results.teams.length + results.players.length;

  return (
    <Container className="py-8">
      <h1 className="mb-4 text-2xl font-extrabold text-fg">البحث في الرياضة</h1>

      <form action="/sport/search" method="get" role="search" className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-lg bg-surface-2 px-4">
          <SearchIcon className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            placeholder="ابحث عن فريق، بطولة، أو لاعب…"
            className="h-12 w-full bg-transparent text-base text-fg outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90"
        >
          بحث
        </button>
      </form>

      {q ? (
        <p className="mb-6 text-sm text-muted">
          {total > 0 ? `${total.toLocaleString('ar-EG')} نتيجة لـ «${q}»` : `لا نتائج لـ «${q}»`}
        </p>
      ) : (
        <p className="mb-6 text-sm text-muted">اكتب كلمةً في الحقل أعلاه للبحث عن فريق، بطولة، أو لاعب.</p>
      )}

      {total > 0 ? (
        <>
          <ResultSection<SearchCompetitionHit>
            title="البطولات"
            items={results.competitions}
            renderItem={(c) => (
              <ResultRow key={`c${c.id}`} href={`/sport/competition/${c.id}`} logo={c.logo} name={c.name} />
            )}
          />
          <ResultSection<SearchTeamHit>
            title="الفرق"
            items={results.teams}
            renderItem={(t) => <ResultRow key={`t${t.id}`} href={`/sport/team/${t.id}`} logo={t.logo} name={t.name} />}
          />
          <ResultSection<SearchPlayerHit>
            title="اللاعبون"
            items={results.players}
            renderItem={(p) => (
              <ResultRow key={`p${p.id}`} href={`/sport/player/${p.id}`} logo={p.photo} name={p.name} sub={p.club} />
            )}
          />
        </>
      ) : q ? (
        <div className="py-16 text-center text-muted">
          <p className="text-lg font-bold text-fg">لا نتائج مطابقة</p>
          <p className="mt-1 text-sm">جرّب كلماتٍ أخرى أو تأكّد من الإملاء.</p>
        </div>
      ) : null}
    </Container>
  );
}
