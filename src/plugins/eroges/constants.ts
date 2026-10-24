import type { ErogeFilter } from './ErogesControls'
// Engine, status and backlog-status option tables. Copied verbatim
// from Nyx's index.html so the F95 title parser keeps matching.

export const SLUG = 'eroges'

export const ENGINES = [
  { label: "Ren'Py", cls: 'renpy' },
  { label: 'RPGM', cls: 'rpgm' },
  { label: 'Unity', cls: 'unity' },
  { label: 'Unreal Engine', cls: 'unreal' },
  { label: 'Godot', cls: 'godot' },
  { label: 'WebGL', cls: 'webgl' },
  { label: 'HTML', cls: 'html' },
  { label: 'Flash', cls: 'flash' },
  { label: 'QSP', cls: 'qsp' },
  { label: 'Wolf RPG', cls: 'wolfrpg' },
  { label: 'Java', cls: 'java' },
  { label: 'Others', cls: 'others' },
] as const

export const STATUSES = ['OnGoing', 'Completed', 'OnHold', 'Abandoned'] as const
export const BACKLOG_STATUSES = ['playing', 'backlog', 'played'] as const
export const BACKLOG_LABELS: Record<string, string> = {
  playing: 'Playing',
  backlog: 'Backlog',
  played:  'Played',
}

export function engineClass(engine?: string): string {
  if (!engine) return ''
  const found = ENGINES.find((e) => e.label.toLowerCase() === engine.toLowerCase())
  return found?.cls ?? 'others'
}

export interface TagPrefs { preferred: Set<string>; avoided: Set<string> }

export function tagPrefsFrom(preferred?: string[], avoided?: string[]): TagPrefs {
  return {
    preferred: new Set((preferred ?? []).map((t) => t.toLowerCase())),
    avoided: new Set((avoided ?? []).map((t) => t.toLowerCase())),
  }
}

export function matchTags(tags: string[] | undefined, prefs: TagPrefs): { liked: string[]; avoided: string[] } {
  const liked: string[] = []
  const avoided: string[] = []
  for (const t of tags ?? []) {
    const key = t.toLowerCase()
    if (prefs.avoided.has(key)) avoided.push(t)
    else if (prefs.preferred.has(key)) liked.push(t)
  }
  return { liked, avoided }
}

// Status filters, shown as the top bar's segments by ErogesView.
export const EROGE_FILTERS: { id: ErogeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'playing', label: 'Playing' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'played', label: 'Played' },
  { id: 'updates', label: 'Updates' },
]
