import { defineConfig } from '@playwright/test'

// Kept lean: only the smoke test runs today. No webServer directive
// because the tests launch Electron themselves via `_electron.launch`.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // Screenshots on failure make CI failures actionable without
    // having to reproduce locally.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
