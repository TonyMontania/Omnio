import { defineConfig } from 'vitest/config'

// Vitest config for pure-logic unit tests. Vitest picks up everything
// under src/**/*.test.ts. Kept scoped to node env — the utilities we
// test (parseCsv, formatIsoDate, mangaToPatch, etc.) never touch the
// DOM. Rust unit tests live under src-tauri/src/**/tests and run via
// `cargo test` from src-tauri/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'src-tauri/**'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
  },
})
