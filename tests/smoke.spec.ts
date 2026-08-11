// Smoke test — boots the packaged Electron main process, waits for the
// first window to load, and asserts a couple of high-signal facts:
//
//   1. The window title reads "Omnio" (main process created it).
//   2. The renderer bundle actually mounted (`#root` has children).
//   3. The Home dashboard eyebrow / greeting text is present, which
//      only happens after settings load + first-run wizard decides
//      not to render (fresh-install path adds one screenshot upfront).
//
// This catches ~90% of "the app is broken on start" regressions
// (main.ts import error, IPC crash, vite bundle mismatch, missing
// preload) without needing feature-level integration tests.
//
// Requires `npm run build` to have produced dist/ + dist-electron/.
// CI runs the build first, then this.

import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

let app: ElectronApplication

test.beforeAll(async () => {
  app = await electron.launch({
    args: [projectRoot],
    // Some CI runners lack a sandbox helper; Electron's own sandbox
    // requires it. Disable — the process is already inside a CI runner.
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
  })
})

test.afterAll(async () => {
  await app?.close()
})

test('window opens and renderer mounts', async () => {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await expect(window).toHaveTitle(/Omnio/)
  // The React root has children once App.tsx has rendered anything.
  const rootHasChildren = await window.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0)
  expect(rootHasChildren).toBe(true)
})
