/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>
    on(channel: string, listener: (event: any, ...args: any[]) => void): void
    off(channel: string, ...args: any[]): void
    send(channel: string, ...args: any[]): void
  }
}