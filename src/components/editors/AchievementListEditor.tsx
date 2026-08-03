// Detailed achievements editor for a Game. Coexists with the flat
// achievementsUnlocked / achievementsTotal string counters — those stay
// as the fast summary; this array is the deep list users can build up
// manually or (future) sync from Steam / IGDB.
//
// Each row: name (required), optional description, optional unlocked date.
// Sorting: unlocked first (most recent), then locked alphabetized.

import { useState } from 'react'
import type { Achievement } from '../../types'

type Props = {
  entries: Achievement[]
  onChange: (next: Achievement[]) => void
}

export default function AchievementListEditor({ entries, onChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const add = () => {
    if (!name.trim()) return
    onChange([...entries, { id: crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined }])
    setName(''); setDescription('')
  }
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id))
  const toggleUnlocked = (id: string) => {
    onChange(entries.map((e) => {
      if (e.id !== id) return e
      return e.unlockedAt ? { ...e, unlockedAt: undefined } : { ...e, unlockedAt: new Date().toISOString().slice(0, 10) }
    }))
  }
  const updateField = <K extends keyof Achievement>(id: string, key: K, value: Achievement[K]) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [key]: value } : e)))
  }

  const unlockedCount = entries.filter((e) => e.unlockedAt).length
  const sorted = [...entries].sort((a, b) => {
    if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1
    if (a.unlockedAt && b.unlockedAt) return b.unlockedAt.localeCompare(a.unlockedAt)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="field-group">
      <label>Achievement list <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>{unlockedCount} / {entries.length} unlocked</span></label>
      <div className="achievement-add-row">
        <input placeholder="Achievement name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="button" onClick={add} disabled={!name.trim()}>+ Add</button>
      </div>
      {sorted.length > 0 && (
        <ul className="achievement-list">
          {sorted.map((a) => (
            <li key={a.id} className={a.unlockedAt ? 'achievement-row unlocked' : 'achievement-row'}>
              <button
                type="button"
                className="achievement-toggle"
                onClick={() => toggleUnlocked(a.id)}
                title={a.unlockedAt ? 'Mark as locked' : 'Mark as unlocked'}
              >{a.unlockedAt ? '★' : '☆'}</button>
              <div className="achievement-body">
                <input className="achievement-name" value={a.name} onChange={(e) => updateField(a.id, 'name', e.target.value)} />
                {a.description !== undefined && (
                  <input className="achievement-desc" placeholder="Description" value={a.description ?? ''} onChange={(e) => updateField(a.id, 'description', e.target.value || undefined)} />
                )}
                {a.unlockedAt && (
                  <input className="achievement-date" type="date" value={a.unlockedAt.slice(0, 10)} onChange={(e) => updateField(a.id, 'unlockedAt', e.target.value || undefined)} />
                )}
              </div>
              <button type="button" className="achievement-delete" onClick={() => remove(a.id)} title="Delete">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
