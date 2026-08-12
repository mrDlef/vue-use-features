import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Separate from vitest.config.ts on purpose: these tests assert on the
// contents of `dist/`, so they require a prior `pnpm build` and must not run
// as part of the regular unit-test loop.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
