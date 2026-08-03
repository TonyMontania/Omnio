// Log of concerts the user has attended for an album / artist entry.
// Shape mirrors RewatchListEditor: a small add-row on top, then a list of
// existing entries with per-row delete. Sorted newest-first for display.

import { useState } from 'react'
import type { ConcertEntry } from '../../types'

type Props = {
  entries: ConcertEntry[]
  onChange: (next: ConcertEntry[]) => void
}

export default function ConcertLogEditor({ entries, onChange }: Props) {
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const [setlist, setSetlist] = useState('')

  const add = () => {
    if (!date && !venue.trim()) return
    onChange([
      { id: crypto.randomUUID(), date, venue: venue.trim(), city: city.trim() || undefined, notes: notes.trim() || undefined, setlist: setlist.trim() || undefined },
      ...entries,
    ])
    setDate(''); setVenue(''); setCity(''); setNotes(''); setSetlist('')
  }
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id))
  const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className="field-group">
      <label>Concerts attended</label>
      <div className="concert-add-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
        <input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="button" onClick={add} disabled={!date && !venue.trim()}>+ Add</button>
      </div>
      <textarea
        className="concert-notes-input"
        placeholder="Setlist (one line per song) or notes — optional, applies to the next Add"
        value={setlist}
        onChange={(e) => setSetlist(e.target.value)}
        rows={2}
      />
      <input
        placeholder="Extra notes — optional"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {sorted.length > 0 && (
        <ul className="concert-list">
          {sorted.map((c) => (
            <li key={c.id} className="concert-row">
              <div className="concert-head">
                <span className="concert-date">{c.date || '—'}</span>
                <span className="concert-venue">{c.venue}</span>
                {c.city && <span className="concert-city">{c.city}</span>}
                <button type="button" className="concert-delete" onClick={() => remove(c.id)} title="Delete">✕</button>
              </div>
              {c.setlist && <pre className="concert-setlist">{c.setlist}</pre>}
              {c.notes && <p className="concert-notes">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
