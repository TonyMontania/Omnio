// Vertical, per-item timeline that stacks every rewatch / reread / replay /
// listen entry on a single line with dates + optional rating and notes.
// Kept under the original name (DetailHistoryTable) so the seven detail
// modals wire up unchanged; only the presentation swapped from a table
// to the timeline layout requested in docs/DEFERRED.md.

import { useState } from 'react'

export interface HistoryEntry {
  id: string
  date?: string
  rating?: number
  notes?: string
}

function fmtDate(raw?: string): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DetailHistoryTable({ label, entries }: {
  label: string
  entries: HistoryEntry[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (entries.length === 0) return null

  const ordered = [...entries].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return db - da
  })

  return (
    <div className="field-group detail-timeline-group">
      <label>{label}</label>
      <ol className="detail-timeline">
        {ordered.map((r) => {
          const hasNotes = !!(r.notes && r.notes.trim())
          const isOpen = !!expanded[r.id]
          return (
            <li key={r.id} className="detail-timeline-row">
              <span className="detail-timeline-dot" aria-hidden="true" />
              <div className="detail-timeline-card">
                <div className="detail-timeline-head">
                  <span className="detail-timeline-date">{fmtDate(r.date)}</span>
                  {r.rating ? <span className="detail-timeline-rating">★ {r.rating}</span> : null}
                  {hasNotes && (
                    <button
                      type="button"
                      className="detail-timeline-toggle"
                      onClick={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide notes' : 'Show notes'}
                    </button>
                  )}
                </div>
                {hasNotes && isOpen && (
                  <p className="detail-timeline-notes">{r.notes}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
