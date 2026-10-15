// Settings file: everything that shapes how Omnio looks and behaves,
// so a second computer can be set up the same way. Library data is not
// included — that's what backups are for.

const MACHINE_FIELDS = [
  'lastCategory', 'welcomeShown', 'autoBackupTarget', 'autoBackupLastAt', 'lastExportFolder',
  'unlockedPlugins', 'hiddenPlugins', 'pluginCardFields',
] as const

export const SECRET_FIELDS = [
  'sgdbApiKey', 'tmdbApiKey', 'igdbClientId', 'igdbClientSecret', 'comicvineApiKey',
  'lastFmApiKey', 'lastFmUsername', 'anidbClient', 'httpProxy',
] as const

export interface SettingsFile {
  app: 'omnio'
  kind: 'settings'
  version: 1
  exportedAt: string
  settings: Record<string, unknown>
  smartLists: unknown[]
}

function without(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out = { ...source }
  for (const k of keys) delete out[k]
  return out
}

export function buildSettingsFile(settings: object, smartLists: unknown[], includeSecrets: boolean, now = new Date()): SettingsFile {
  let clean = without(settings as Record<string, unknown>, MACHINE_FIELDS)
  if (!includeSecrets) clean = without(clean, SECRET_FIELDS)
  return { app: 'omnio', kind: 'settings', version: 1, exportedAt: now.toISOString(), settings: clean, smartLists }
}

export function parseSettingsFile(text: string): SettingsFile {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('That file isn\'t valid JSON.') }
  const f = data as Partial<SettingsFile>
  if (!f || f.app !== 'omnio' || f.kind !== 'settings' || typeof f.settings !== 'object' || f.settings === null) {
    throw new Error('That isn\'t an Omnio settings file.')
  }
  return {
    app: 'omnio', kind: 'settings', version: 1,
    exportedAt: String(f.exportedAt ?? ''),
    settings: without(f.settings as Record<string, unknown>, MACHINE_FIELDS),
    smartLists: Array.isArray(f.smartLists) ? f.smartLists : [],
  }
}

// Imported values win; this computer keeps its own machine-specific
// fields, and its own keys when the file carries none.
export function mergeImportedSettings<T extends object>(current: T, file: SettingsFile): T {
  return { ...current, ...file.settings } as T
}

export function mergeSmartLists<T extends { id: string }>(current: T[], imported: unknown[]): T[] {
  const incoming = imported.filter((l): l is T => !!l && typeof (l as T).id === 'string')
  const ids = new Set(incoming.map((l) => l.id))
  return [...current.filter((l) => !ids.has(l.id)), ...incoming]
}
