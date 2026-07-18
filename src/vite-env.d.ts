/// <reference types="vite/client" />

// Injected at build time by vite.config.ts from package.json → version.
declare const __APP_VERSION__: string

interface Window {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
    off(channel: string, ...args: unknown[]): void
    send(channel: string, ...args: unknown[]): void
  }
}
