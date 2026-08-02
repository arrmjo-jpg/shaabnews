import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// Pin the file-tracing root to this app so Next does not infer a parent workspace
// when sibling lockfiles exist.
const API = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),

  experimental: {
    cpus: 1,
    workerThreads: false,
    webpackMemoryOptimizations: true,
  },

  // قارئ الجريدة (Blade/SSR) يعيش في تطبيق Laravel؛ نمرّر مساراته وأصوله إلى أصل Next
  // ليصير القارئ القائم متاحاً من دومين الموقع دون إعادة بناء. مسبوق باللغة (ar|en) فلا
  // يتعارض مع صفحة /epaper (الهبوط في Next). /build/* أصول القارئ المبنيّة (pdf.js/cmaps/css).
  //
  // ROOT CAUSE FIX (كل تنزيل/عرض PDF للجريدة الرقمية يفشل بـ404 في الإنتاج): EpaperDocumentDelivery
  // ::mint() يوقّع رابط بثّ احتياطي على /epaper/stream/{epaper} (بلا بادئة لغة — راجع
  // routes/web.php) حين يتعذّر/يُعطَّل التخزين البعيد (RemoteStorage::enabled() === false فعليًا في
  // الإنتاج الآن). هذا المسار لم يكن ضمن قواعد rewrites أعلاه (فقط /:locale/epaper/* و/build/*
  // مغطّيان) فيسقط على راوتر Next نفسه ⇒ 404 قبل أن يصل لارافيل إطلاقاً — يفسّر فشل كل عرض/تنزيل
  // PDF للجريدة حاليًا (لا استثناء نادر).
  async rewrites() {
    if (!API) return [];
    return [
      { source: "/:locale(ar|en)/epaper", destination: `${API}/:locale/epaper` },
      { source: "/:locale(ar|en)/epaper/:path*", destination: `${API}/:locale/epaper/:path*` },
      { source: "/epaper/stream/:path*", destination: `${API}/epaper/stream/:path*` },
      { source: "/build/:path*", destination: `${API}/build/:path*` },
    ];
  },

  // Legacy URL migration for routes retired in the site refactor. Article/category shapes map
  // 1:1 to their new equivalents (same backend slug/id, just a new path prefix) so those are
  // permanent redirects for SEO link-equity. /en/* (English locale, fully removed) and /writers
  // (directory page removed, no replacement) don't have an equivalent page to point at — routed
  // home rather than left as a bare 404, but not asserted as a permanent 1:1 replacement.
  //
  // 2026-07-18 — public URL restructuring (/news/*): straight prefix renames with no DB lookup
  // needed (search/live/videos/writer) are handled here at the edge, cheaper than a Server
  // Component. Article (/articles/*) and category (/category/*) canonical URLs now embed data
  // that only a DB read can resolve (published_at date, category ancestor chain) — those stay
  // as redirect-only page.tsx stubs (frontend/src/app/(site)/articles/[idslug],
  // frontend/src/app/(site)/category/[slug]) rather than static rules here. The two legacy
  // /category/{id}/{slug} rules below now chain through that stub (one extra hop) rather than
  // jumping straight to /news/category/{...} — acceptable for rarely-hit legacy links; the
  // alternative would require duplicating the DB-dependent nested-path resolution here, which
  // next.config.ts cannot do.
  async redirects() {
    return [
      { source: "/article/:path*", destination: "/articles/:path*", permanent: true },
      { source: "/category/:id(\\d+)/:slug*", destination: "/category/:slug*", permanent: true },
      { source: "/category-:id(\\d+)/:slug*", destination: "/category/:slug*", permanent: true },
      { source: "/writer/:path*", destination: "/news/writer/:path*", permanent: true },
      { source: "/search", destination: "/news/search", permanent: true },
      { source: "/live", destination: "/news/live", permanent: true },
      { source: "/live/:path*", destination: "/news/live/:path*", permanent: true },
      { source: "/videos", destination: "/news/videos", permanent: true },
      { source: "/videos/:path*", destination: "/news/videos/:path*", permanent: true },
      { source: "/writers", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
      { source: "/en/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
