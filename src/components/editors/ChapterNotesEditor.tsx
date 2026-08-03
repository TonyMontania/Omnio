// Per-chapter reading notes for a Book. Small editor: chapter label (free-
// form so "Prologue" / "1" / "1.5" / "Chapter 12 — The Return" all work)
// plus the note body. Sorted in insertion order — chapters aren't always
// numeric so a natural sort would misorder "10" vs "2" and forcing manual
// ordering keeps the display honest.

import { useState } from 'react'
import type { ChapterNote } from '../../types'

type Props = {
  entries: ChapterNote[]
  onChange: (next: ChapterNote[]) => void
}

export default function ChapterNotesEditor({ entries, onChange }: Props) {
  const [chapter, setChapter] = useState('')
  const [note, setNote] = useState('')

  const add = () => {
    if (!note.trim()) return
    onChange([...entries, { id: crypto.randomUUID(), chapter: chapter.trim() || '—', note: note.trim() }])
    setChapter(''); setNote('')
  }
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id))
  const update = (id: string, patch: Partial<ChapterNote>) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  return (
    <div className="field-group">
      <label>Notes per chapter</label>
      <div className="chapter-notes-add">
        <input className="chapter-notes-num" placeholder="Ch. e.g. 1, Prologue…" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        <textarea className="chapter-notes-input" placeholder="Note…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <button type="button" onClick={add} disabled={!note.trim()}>+ Add</button>
      </div>
      {entries.length > 0 && (
        <ul className="chapter-notes-list">
          {entries.map((n) => (
            <li key={n.id} className="chapter-notes-row">
              <input
                className="chapter-notes-chapter"
                value={n.chapter}
                onChange={(e) => update(n.id, { chapter: e.target.value })}
              />
              <textarea
                className="chapter-notes-body"
                value={n.note}
                onChange={(e) => update(n.id, { note: e.target.value })}
                rows={2}
              />
              <button type="button" className="chapter-notes-delete" onClick={() => remove(n.id)} title="Delete">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
