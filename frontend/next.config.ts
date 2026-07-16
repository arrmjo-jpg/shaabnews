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
  async rewrites() {
    if (!API) return [];
    return [
      { source: "/:locale(ar|en)/epaper", destination: `${API}/:locale/epaper` },
      { source: "/:locale(ar|en)/epaper/:path*", destination: `${API}/:locale/epaper/:path*` },
      { source: "/build/:path*", destination: `${API}/build/:path*` },
    ];
  },

  // Legacy URL migration for routes retired in the site refactor. Article/category shapes map
  // 1:1 to their new equivalents (same backend slug/id, just a new path prefix) so those are
  // permanent redirects for SEO link-equity. /en/* (English locale, fully removed) and /writers
  // (directory page removed, no replacement) don't have an equivalent page to point at — routed
  // home rather than left as a bare 404, but not asserted as a permanent 1:1 replacement.
  async redirects() {
    return [
      { source: "/article/:path*", destination: "/articles/:path*", permanent: true },
      { source: "/category/:id(\\d+)/:slug*", destination: "/category/:slug*", permanent: true },
      { source: "/category-:id(\\d+)/:slug*", destination: "/category/:slug*", permanent: true },
      { source: "/writers", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
      { source: "/en/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
