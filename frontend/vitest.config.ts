import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside a Next.js server request — irrelevant to
      // unit tests that only exercise plain data-fetching/parsing functions.
      'server-only': path.resolve(dirname, 'test/mocks/server-only.ts'),
    },
  },
});
