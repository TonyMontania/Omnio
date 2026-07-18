/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
    off(channel: string, ...args: unknown[]): void
    send(channel: string, ...args: unknown[]): void
  }
}
