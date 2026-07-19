/// <reference types="vite/client" />

// Injected at build time by vite.config.ts from package.json → version.
declare const __APP_VERSION__: string

interface Window {
  // IPC is an untyped boundary — the return type varies per channel, and
  // individual callers cast to what they know they'll get back. Using `any`
  // here (rather than `unknown`) is deliberate so caller-side `.then((x: T)`
  // annotations keep working without every call site having to sprinkle
  // generic parameters.
  ipcRenderer: {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    invoke(channel: string, ...args: any[]): Promise<any>
    on(channel: string, listener: (event: any, ...args: any[]) => void): void
    off(channel: string, ...args: any[]): void
    send(channel: string, ...args: any[]): void
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
