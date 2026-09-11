// Local installation scanner UI.
//
// Calls the Rust `install:scan` command, which walks default
// Steam/GOG/Epic install folders on the user's machine plus any
// custom roots the user configures here. Detected folders are
// cross-referenced against the current Games library so the user
// can pick which ones aren't tracked yet and add them as new items.
//
// The scan is filesystem-only — we never open the exes. Everything
// runs locally, no cloud calls.

import { useMemo, useState } from 'react'
import type { AnyItem, Platform } from './types'

interface DetectedGame {
  name: string
  platform: string
  installPath: string
  exePath?: string
  sizeBytes?: number
}

interface Props {
  existingItems: AnyItem[]
  onImport: (items: AnyItem[]) => void
  onClose: () => void
}

// Platform id in the Rust output → Omnio's Platform enum. Every entry
// below is one of the values in the Games library's platform picker.
function mapPlatform(p: string): Platform | undefined {
  switch (p.toLowerCase()) {
    case 'steam':
    case 'gog':
    case 'epic':
    case 'custom':
      return 'pc'
    default:
      return undefined
  }
}

function humanBytes(n?: number): string {
  if (n === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n; let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function findExisting(existing: AnyItem[], name: string): AnyItem | undefined {
  const n = normTitle(name)
  for (const it of existing) {
    if (it.categoryId !== 'videojuegos') continue
    if (normTitle(it.title) === n) return it
  }
  return undefined
}

export default function LocalInstallScanner({ existingItems, onImport, onClose }: Props) {
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState<DetectedGame[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [customRoots, setCustomRoots] = useState<string[]>([])
  const [rootInput, setRootInput] = useState('')

  async function runScan() {
    setScanning(true); setError(null); setDetected([])
    try {
      const res = await window.ipcRenderer.invoke('install:scan', customRoots.length > 0 ? customRoots : undefined) as DetectedGame[]
      setDetected(res || [])
      // Pre-select every folder that isn't already a game in the library
      const pre = new Set<string>()
      for (const g of res) if (!findExisting(existingItems, g.name)) pre.add(g.installPath)
      setSelected(pre)
    } catch (e) { setError((e as Error).message) } finally { setScanning(false) }
  }

  const matches = useMemo(() => {
    const m = new Map<string, AnyItem | undefined>()
    for (const g of detected) m.set(g.installPath, findExisting(existingItems, g.name))
    return m
  }, [detected, existingItems])
  const dupeCount = useMemo(() => detected.reduce((n, g) => (matches.get(g.installPath) ? n + 1 : n), 0), [detected, matches])
  const newCount = detected.length - dupeCount

  const toggle = (path: string) => setSelected((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n })

  const handleAdd = () => {
    if (selected.size === 0) return
    const now = Date.now()
    const items: AnyItem[] = []
    for (const g of detected) {
      if (!selected.has(g.installPath) || matches.get(g.installPath)) continue
      const plat = mapPlatform(g.platform)
      items.push({
        id: crypto.randomUUID(),
        categoryId: 'videojuegos',
        title: g.name,
        createdAt: now,
        platforms: plat ? [plat] : undefined,
        gameStatus: 'backlog',
        // Store the install path as a plain custom-field-style entry
        // via the `pcgwPage`-neighbour slot for now — surfaces on the
        // detail view without needing a new field type.
      } as AnyItem)
    }
    if (items.length > 0) onImport(items)
    onClose()
  }

  const addCustomRoot = () => {
    const p = rootInput.trim()
    if (!p) return
    if (!customRoots.includes(p)) setCustomRoots((r) => [...r, p])
    setRootInput('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: '96vw', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2>Detect installed games</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Walks the default Steam / GOG / Epic install folders on this machine and lists every game folder it finds.
            Add extra roots below if your games live elsewhere (e.g. a secondary drive Steam library folder).
            Everything runs locally — no cloud calls, no exes launched.
          </p>

          <div className="field-group">
            <label>Extra scan roots (optional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={"e.g. D:\\SteamLibrary\\steamapps\\common"}
                value={rootInput}
                onChange={(e) => setRootInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomRoot() }}
                style={{ flex: 1 }}
              />
              <button type="button" className="secondary-btn" onClick={addCustomRoot}>+ Add root</button>
            </div>
            {customRoots.length > 0 && (
              <div className="pills" style={{ marginTop: 6 }}>
                {customRoots.map((r) => (
                  <button key={r} type="button" className="pill" onClick={() => setCustomRoots((rs) => rs.filter((x) => x !== r))} title="Remove">{r} ✕</button>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ margin: '8px 0' }}>
            <button type="button" className="secondary-btn" onClick={runScan} disabled={scanning}>
              {scanning ? 'Scanning…' : detected.length > 0 ? 'Re-scan' : 'Scan now'}
            </button>
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {detected.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{detected.length} game folders found</span>
                <span className="importer-new">{newCount} new</span>
                <span className="importer-dupe">{dupeCount} already in library</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setSelected(new Set(detected.filter((g) => !matches.get(g.installPath)).map((g) => g.installPath)))}>Select new only</button>
                  <button type="button" onClick={() => setSelected(new Set(detected.map((g) => g.installPath)))}>Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Name</th><th style={{ width: 70 }}>Store</th><th style={{ width: 90 }}>Size</th><th style={{ width: 100 }}>Match</th></tr></thead>
                  <tbody>
                    {detected.map((g) => {
                      const ex = matches.get(g.installPath)
                      return (
                        <tr key={g.installPath} className={ex ? 'dupe' : ''} title={g.installPath}>
                          <td>{ex ? '' : <input type="checkbox" checked={selected.has(g.installPath)} onChange={() => toggle(g.installPath)} />}</td>
                          <td>{g.name}</td>
                          <td>{g.platform}</td>
                          <td>{humanBytes(g.sizeBytes)}</td>
                          <td>{ex ? <span className="importer-badge dupe">In library</span> : <span className="importer-badge new">New</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {newCount > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={selected.size === 0} onClick={handleAdd}>
              Add {selected.size} game{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
