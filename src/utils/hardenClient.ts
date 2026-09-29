// Production-only lockdown for the renderer window: blocks the shortcut
// paths that let a curious user open a devtools panel, print the DOM, or
// dump the page source. Dev builds skip this entirely so the developer
// keeps full access. Text inputs still get the native right-click menu
// (copy/paste) so this doesn't hurt everyday form usage.

export function installClientHardening() {
  if (!import.meta.env.PROD) return

  const isEditable = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    if (!el || !el.tagName) return false
    if (el.isContentEditable) return true
    const tag = el.tagName.toUpperCase()
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  window.addEventListener('contextmenu', (e) => {
    if (isEditable(e.target)) return
    e.preventDefault()
  }, { capture: true })

  window.addEventListener('keydown', (e) => {
    const key = e.key
    const upper = key.length === 1 ? key.toUpperCase() : key
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    if (key === 'F12') { e.preventDefault(); return }
    if (ctrl && shift && (upper === 'I' || upper === 'J' || upper === 'C' || upper === 'K')) { e.preventDefault(); return }
    if (ctrl && !shift && upper === 'U') { e.preventDefault(); return }
    if (ctrl && !shift && upper === 'P') { e.preventDefault(); return }
    // F5 / Ctrl+R are intentionally NOT blocked here — App owns them as
    // "refresh library from disk" and handles preventDefault itself.
  }, { capture: true })
}
