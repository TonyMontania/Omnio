// Keyboard actions catalog + combo helpers.
//
// The App keydown handler used to hardcode every shortcut (Ctrl+F,
// Ctrl+K, Ctrl+Z, F5, ?, Ctrl+H). This module lifts the mapping into
// data so the same table drives:
//   - the runtime dispatcher (matchCombo → action id)
//   - the Settings editor (list of actions the user can rebind)
//   - the "Keyboard shortcuts" reference modal
//
// Combos are stored as canonical strings like "Ctrl+F" or
// "Ctrl+Shift+Z" — order is fixed (Ctrl+Alt+Shift+Meta+KEY) so a
// stored override equals a runtime formatCombo() result on identity.

export interface KeyboardActionDef {
  id: string
  label: string
  description: string
  defaultCombo: string
}

export const KEYBOARD_ACTIONS: KeyboardActionDef[] = [
  { id: 'focus-search',      label: 'Focus library search',  description: 'Jump to the search box at the top of the current library.', defaultCombo: 'Ctrl+F' },
  { id: 'open-global-search',label: 'Open global search',    description: 'Global title lookup across every library.',                 defaultCombo: 'Ctrl+K' },
  { id: 'undo',              label: 'Undo',                  description: 'Undo the last data change.',                                 defaultCombo: 'Ctrl+Z' },
  { id: 'redo',              label: 'Redo',                  description: 'Redo an undone change.',                                     defaultCombo: 'Ctrl+Shift+Z' },
  { id: 'redo-alt',          label: 'Redo (alt)',            description: 'Alternate binding for redo.',                                defaultCombo: 'Ctrl+Y' },
  { id: 'refresh',           label: 'Refresh from disk',     description: 'Reload the library from disk without applying settings.',    defaultCombo: 'F5' },
  { id: 'shortcuts',         label: 'Show shortcuts',        description: 'Open the keyboard-shortcuts cheat sheet.',                   defaultCombo: '?' },
  { id: 'home',              label: 'Go to Home',            description: 'Jump to the Home dashboard.',                                defaultCombo: 'Ctrl+H' },
]

// Build the canonical combo string for a keyboard event so we can
// compare against stored overrides / defaults.
export function formatCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const k = e.key
  // Normalize letter keys to upper-case; leave punctuation alone.
  const named = k.length === 1 ? k.toUpperCase() : k
  // Skip pure modifier presses so a lonely Ctrl doesn't produce "Ctrl".
  if (named === 'Control' || named === 'Meta' || named === 'Alt' || named === 'Shift') return ''
  parts.push(named)
  return parts.join('+')
}

// Match a keydown event against the active table (defaults +
// user overrides) and return the matching action id, or null.
// Overrides win over defaults for the same id, and a blank override
// disables the default for that action.
export function matchAction(e: KeyboardEvent, overrides?: Record<string, string>): string | null {
  const combo = formatCombo(e)
  if (!combo) return null
  for (const action of KEYBOARD_ACTIONS) {
    const bound = overrides?.[action.id] !== undefined ? overrides[action.id] : action.defaultCombo
    if (bound && bound === combo) return action.id
  }
  return null
}
