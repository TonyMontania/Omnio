// Dated activity log for an item — replays, relectures, first
// finishes, drops, and plain journal notes. Called "Rewatch history"
// / "Reread history" / "Play history" in each editor's UI, but the
// same shape backs all of them. Every entry carries a `kind` so the
// detail views can distinguish a first finish from a rewatch and
// count "3rd time" chips accordingly.

import { useState } from 'react'
import type { RewatchEntry, RewatchKind } from '../../types'
import { StarRatingInput } from '../../StarRating'

// The verbs shown in the picker adapt to the surrounding category so
// "Finished reading" reads naturally in Books and "Finished watching"
// in Anime. Missing labels fall back to a bare verb.
export interface RewatchLabels {
  rewatch?: string   // "Rewatched" / "Reread" / "Replayed"
  started?: string   // "Started watching" / "Started reading" / "Started playing"
  finished?: string  // "Finished watching" / "Finished reading" / "Finished playing"
  dropped?: string   // "Dropped"
  note?: string      // "Journal note"
}

const KIND_ORDER: RewatchKind[] = ['rewatch', 'started', 'finished', 'dropped', 'note']

const DEFAULT_LABELS: Required<RewatchLabels> = {
  rewatch: 'Rewatched',
  started: 'Started',
  finished: 'Finished',
  dropped: 'Dropped',
  note: 'Note',
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function RewatchListEditor({
  rewatches, onAdd, onRemove, onUpdate, onRatingChange, labels,
}: {
  rewatches: RewatchEntry[]
  onAdd: (r: Omit<RewatchEntry, 'id'>) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<RewatchEntry>) => void
  onRatingChange: (id: string, r: number) => void
  labels?: RewatchLabels
}) {
  const L = { ...DEFAULT_LABELS, ...(labels ?? {}) }
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [kind, setKind] = useState<RewatchKind>('rewatch')

  const handleAdd = () => {
    if (!date) return
    onAdd({ date, kind, notes: notes.trim() || undefined })
    setDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setKind('rewatch')
  }

  // Count finishes (including legacy entries with no kind, which we
  // treated as rewatches — those DO count as "another time through").
  // We build a per-entry "Nth time" only for entries that mark an
  // actual completion of the work.
  const sorted = [...rewatches].sort((a, b) => a.date.localeCompare(b.date))
  const nthFor = new Map<string, number>()
  let seenCompletions = 0
  for (const r of sorted) {
    const k = r.kind ?? 'rewatch'
    if (k === 'rewatch' || k === 'finished') {
      seenCompletions += 1
      // First completion isn't "1st time" — the item's original finish
      // is implicit (finishedAt). This is the 2nd, 3rd, etc.
      if (seenCompletions >= 1) nthFor.set(r.id, seenCompletions + 1)
    }
  }

  const verbFor = (k: RewatchKind | undefined): string => {
    switch (k ?? 'rewatch') {
      case 'started': return L.started
      case 'finished': return L.finished
      case 'dropped': return L.dropped
      case 'note': return L.note
      default: return L.rewatch
    }
  }

  return (
    <div className="track-editor">
      <div className="track-editor-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="rewatch-kind" value={kind} onChange={(e) => setKind(e.target.value as RewatchKind)} title="What kind of entry">
          {KIND_ORDER.map((k) => <option key={k} value={k}>{verbFor(k)}</option>)}
        </select>
        <input className="track-name" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="button" onClick={handleAdd}>Add entry</button>
      </div>
      {sorted.length > 0 && (
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">Date</th>
              <th>Kind</th>
              <th className="col-rating">Rating</th>
              <th className="col-title">Notes</th>
              <th />
              <th className="col-spacer"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const nth = nthFor.get(r.id)
              const currentKind = r.kind ?? 'rewatch'
              return (
                <tr key={r.id}>
                  <td className="col-num">{r.date}</td>
                  <td>
                    <select
                      className="rewatch-kind"
                      value={currentKind}
                      onChange={(e) => onUpdate(r.id, { kind: e.target.value as RewatchKind })}
                    >
                      {KIND_ORDER.map((k) => <option key={k} value={k}>{verbFor(k)}</option>)}
                    </select>
                    {nth && <span className="rewatch-nth-chip"> · {ordinal(nth)} time</span>}
                  </td>
                  <td className="col-rating"><StarRatingInput value={r.rating ?? 0} onChange={(v) => onRatingChange(r.id, v)} /></td>
                  <td className="col-title"><input className="track-artist-cell" value={r.notes ?? ''} onChange={(e) => onUpdate(r.id, { notes: e.target.value })} placeholder="—" /></td>
                  <td><button type="button" className="track-remove" onClick={() => onRemove(r.id)}>✕</button></td>
                  <td className="col-spacer"></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
