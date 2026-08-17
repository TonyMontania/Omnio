import { defineConfig } from 'vitest/config'

// Vitest config for pure-logic unit tests. Playwright's smoke test in
// tests/smoke.spec.ts drives Electron end-to-end from its own config
// (see playwright.config.ts); Vitest picks up everything under
// src/**/*.test.ts. Kept scoped to node env — the utilities we test
// (parseCsv, formatIsoDate, mangaToPatch, etc.) never touch the DOM.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'dist-electron/**'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
  },
})
