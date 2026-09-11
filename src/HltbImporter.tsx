// HowLongToBeat backlog patcher.
//
// HLTB doesn't ship an official CSV export, so we take a paste-friendly
// text/CSV format:
//
//   Hollow Knight, 26.5
//   Elden Ring, 60
//   Dark Souls; 45
//   Celeste\t8
//
// Any line with a title followed by a numeric hours value works —
// delimiter is comma, semicolon or tab. Blank lines and lines starting
// with `#` are ignored. First column is title, second is main-story
// hours. Rows patch `hltbHours` on existing Games; games not already in
// the library are skipped (no covers or metadata to build from).
//
// Fuzzy title matching: exact (case-insensitive) first, then title
// without punctuation, then substring. The preview lets the user
// override matches per row.

import { useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  existingItems: Item[]
  onPatch: (patches: { id: string; hltbHours: number }[]) => void
  onClose: () => void
}

type Row = {
  key: string
  title: string
  hours: number
  matchedId?: string
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function findMatch(existing: Item[], title: string): Item | undefined {
  const nLc = title.trim().toLowerCase()
  const norm = normalize(title)
  const games = existing.filter((i) => i.categoryId === 'videojuegos')
  // 1. exact case-insensitive
  const exact = games.find((g) => g.title.trim().toLowerCase() === nLc)
  if (exact) return exact
  // 2. normalized (strip punctuation)
  const nrm = games.find((g) => normalize(g.title) === norm)
  if (nrm) return nrm
  // 3. substring both ways
  const sub = games.find((g) => normalize(g.title).includes(norm) || norm.includes(normalize(g.title)))
  return sub
}
function parseInput(raw: string): Row[] {
  const rows: Row[] = []
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    // Split on tab, semicolon or comma (last takes precedence when
    // multiple present — HLTB titles rarely have tabs, so tab first)
    const parts = line.includes('\t') ? line.split('\t')
      : line.includes(';') ? line.split(';')
      : line.split(',')
    if (parts.length < 2) continue
    const hoursRaw = parts.pop()!.trim()
    const title = parts.join(',').trim()
    const hours = parseFloat(hoursRaw)
    if (!title || !Number.isFinite(hours) || hours <= 0) continue
    rows.push({ key: crypto.randomUUID(), title, hours })
  }
  return rows
}

export default function HltbImporter({ existingItems, onPatch, onClose }: Props) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const parseAndMatch = () => {
    setError(null)
    const parsed = parseInput(text)
    if (parsed.length === 0) { setError('No usable rows. Expected `title, hours` per line.'); return }
    const withMatches: Row[] = parsed.map((r) => {
      const m = findMatch(existingItems, r.title)
      return { ...r, matchedId: m?.id }
    })
    setRows(withMatches)
    setSelected(new Set(withMatches.filter((r) => r.matchedId).map((r) => r.key)))
  }

  const gamesById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of existingItems) if (it.categoryId === 'videojuegos') m.set(it.id, it)
    return m
  }, [existingItems])
  const matchedCount = useMemo(() => rows.filter((r) => r.matchedId).length, [rows])

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const setMatch = (key: string, id: string) => setRows((rs) => rs.map((r) => r.key === key ? { ...r, matchedId: id || undefined } : r))

  const handleImport = () => {
    const patches: { id: string; hltbHours: number }[] = []
    for (const r of rows) {
      if (!selected.has(r.key) || !r.matchedId) continue
      patches.push({ id: r.matchedId, hltbHours: r.hours })
    }
    if (patches.length > 0) onPatch(patches)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import HowLongToBeat times</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Paste one <code>title, hours</code> per line. Uses comma, semicolon or tab as separator.
            Rows patch <code>hltbHours</code> on matching games in your library — this feeds the
            "Shortest to beat" backlog sort. Games not already in your library are skipped.
          </p>
          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Hollow Knight, 26.5\nElden Ring, 60\nCeleste, 8"}
            style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
          />
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="secondary-btn" onClick={parseAndMatch} disabled={!text.trim()}>Parse & match</button>
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} entries</span>
                <span className="importer-new">{matchedCount} matched</span>
                <span className="importer-dupe">{rows.length - matchedCount} unmatched</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setSelected(new Set(rows.filter((r) => r.matchedId).map((r) => r.key)))}>Select matched</button>
                  <button type="button" onClick={() => setSelected(new Set())}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Title (paste)</th><th style={{ width: 70 }}>Hours</th><th>Matched game</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const match = r.matchedId ? gamesById.get(r.matchedId) : undefined
                      return (
                        <tr key={r.key} className={match ? '' : 'dupe'}>
                          <td><input type="checkbox" checked={selected.has(r.key)} disabled={!r.matchedId} onChange={() => toggle(r.key)} /></td>
                          <td>{r.title}</td>
                          <td>{r.hours}h</td>
                          <td>
                            <select value={r.matchedId ?? ''} onChange={(e) => setMatch(r.key, e.target.value)}>
                              <option value="">— no match —</option>
                              {Array.from(gamesById.values()).map((g) => (
                                <option key={g.id} value={g.id}>{g.title}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={selected.size === 0} onClick={handleImport}>
              Patch {selected.size} game{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
