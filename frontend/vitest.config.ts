import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside a Next.js server request — irrelevant to
      // unit tests that only exercise plain data-fetching/parsing functions.
      'server-only': path.resolve(dirname, 'test/mocks/server-only.ts'),
      // مطابق لـ tsconfig.json's paths ("@/*" -> "./src/*") — Vite/Vitest لا يقرآن tsconfig
      // paths تلقائيًّا (خلافًا لـ Next.js نفسه)، فالتعريف هنا ضروريّ لأي اختبار يستورد بالمسار @/.
      '@': path.resolve(dirname, 'src'),
    },
  },
});
