import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://vitejs.dev/config/
//
// Vite drives the renderer only. The Tauri backend lives under
// `src-tauri/` and is built by `cargo` / `tauri build`. When the app
// runs via `tauri dev`, tauri-cli's `beforeDevCommand` invokes
// `vite dev` which serves the SPA at :5173; tauri wraps that in the
// native window.
//
// Chokidar is told to ignore `src-tauri/` so cargo's build artifacts
// don't trigger hot-reload cycles (Windows locks intermediates and
// vite's watcher would EBUSY-crash on them).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    watch: { ignored: ['**/src-tauri/**'] },
  },
  plugins: [react()],
})
