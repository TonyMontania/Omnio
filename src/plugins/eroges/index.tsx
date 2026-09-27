// Plugin registration for Eroges. This file's presence — under
// gitignored `src/categories/eroges/` — is what makes the sidebar
// entry appear. Removing this folder makes the plugin disappear
// cleanly, no other file needs to change.

import type { PluginDef } from '../registry'
import ErogesView from './ErogesView'
import { loadData } from './ipc'
import { reportPluginCount } from '../counts'
import { SLUG } from './constants'

// eslint-disable-next-line react-refresh/only-export-components
const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const def: PluginDef = {
  slug: 'eroges',
  label: 'Eroges',
  icon: HeartIcon,
  View: ErogesView,
  cardFields: [
    { value: 'title', label: 'Title', default: true },
    { value: 'version', label: 'Version', default: true },
    { value: 'creator', label: 'Creator', default: true },
    { value: 'engine', label: 'Engine', default: true },
    { value: 'vn', label: 'VN', default: true },
    { value: 'status', label: 'Status', default: true },
  ],
  // Read the JSON once at boot so the sidebar count is populated
  // before the user opens the library. The ipcRenderer shim installs
  // on renderer boot too, so this Promise just waits its turn.
  preload: async () => {
    try {
      const data = await loadData()
      reportPluginCount(SLUG, data.games.length)
    } catch { /* first-run / no file yet — count stays 0 */ }
  },
}

export default def
