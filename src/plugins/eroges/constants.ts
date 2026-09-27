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

export function engineClass(engine?: string): string {
  if (!engine) return ''
  const found = ENGINES.find((e) => e.label.toLowerCase() === engine.toLowerCase())
  return found?.cls ?? 'others'
}
