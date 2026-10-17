import { isTauriHost } from './ipc-shim'

// Windows and Linux run without the OS frame and draw their own title
// bar; macOS keeps its native one and the browser build has no window.
export function usesCustomTitleBar(): boolean {
  return isTauriHost() && !/Mac/i.test(navigator.platform || navigator.userAgent)
}
