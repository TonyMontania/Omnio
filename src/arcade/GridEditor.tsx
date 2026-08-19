// In-place editor for a game's grid axes. Users type characters +
// difficulties + character codes; the mini-grid and detail grid update
// live. Kept compact so it fits on the same detail page as the runs
// list — no separate modal.

import { useState } from 'react'
import type { ArcadeGame, RunFlag } from '../types/arcade'
import { RUN_FLAG_OPTIONS } from '../types/arcade'

interface Props {
  game: ArcadeGame
  onUpdate: (patch: Partial<ArcadeGame>) => void
}

export default function GridEditor({ game, onUpdate }: Props) {
  const [charDraft, setCharDraft] = useState('')
  const [charCodeDraft, setCharCodeDraft] = useState('')
  const [diffDraft, setDiffDraft] = useState('')

  const grid = game.grid ?? { characters: [], difficulties: [], trackedFlags: [] }
  const codes = game.characterCodes ?? []

  const addCharacter = () => {
    const c = charDraft.trim()
    if (!c) return
    onUpdate({
      grid: { ...grid, characters: [...grid.characters, c] },
      characterCodes: [...codes, (charCodeDraft.trim() || c.slice(0, 2).toUpperCase())],
    })
    setCharDraft(''); setCharCodeDraft('')
  }
  const removeCharacter = (i: number) => {
    onUpdate({
      grid: { ...grid, characters: grid.characters.filter((_, idx) => idx !== i) },
      characterCodes: codes.filter((_, idx) => idx !== i),
    })
  }
  const setCode = (i: number, code: string) => {
    const next = [...codes]
    next[i] = code
    onUpdate({ characterCodes: next })
  }

  const addDifficulty = () => {
    const d = diffDraft.trim()
    if (!d) return
    onUpdate({ grid: { ...grid, difficulties: [...grid.difficulties, d] } })
    setDiffDraft('')
  }
  const removeDifficulty = (i: number) => {
    onUpdate({ grid: { ...grid, difficulties: grid.difficulties.filter((_, idx) => idx !== i) } })
  }

  const toggleFlag = (f: RunFlag) => {
    const next = grid.trackedFlags.includes(f)
      ? grid.trackedFlags.filter((x) => x !== f)
      : [...grid.trackedFlags, f]
    onUpdate({ grid: { ...grid, trackedFlags: next } })
  }

  return (
    <div className="grid-editor">
      <div className="field-group">
        <label>Rows — Difficulties (top-to-bottom)</label>
        <div className="tag-list">
          {grid.difficulties.map((d, i) => (
            <span key={i} className="tag-chip">
              {d}
              <button type="button" onClick={() => removeDifficulty(i)} title="Remove">✕</button>
            </span>
          ))}
        </div>
        <div className="field-inline-add">
          <input
            value={diffDraft}
            onChange={(e) => setDiffDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDifficulty() } }}
            placeholder="Add difficulty (e.g. Lunatic, Hard, Normal, Easy)"
          />
          <button type="button" onClick={addDifficulty}>+ Add</button>
        </div>
      </div>

      <div className="field-group">
        <label>Columns — Characters (left-to-right)</label>
        <div className="grid-editor-chars">
          {grid.characters.map((c, i) => (
            <div key={i} className="grid-editor-char">
              <span className="grid-editor-char-name">{c}</span>
              <input
                className="grid-editor-code"
                value={codes[i] ?? ''}
                onChange={(e) => setCode(i, e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="code"
                title="Short code shown under the mini-grid"
              />
              <button type="button" onClick={() => removeCharacter(i)} title="Remove">✕</button>
            </div>
          ))}
        </div>
        <div className="field-inline-add">
          <input
            value={charDraft}
            onChange={(e) => setCharDraft(e.target.value)}
            placeholder="Character / ship / loadout (e.g. Reimu A)"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCharacter() } }}
          />
          <input
            value={charCodeDraft}
            onChange={(e) => setCharCodeDraft(e.target.value.toUpperCase())}
            maxLength={4}
            className="grid-editor-code"
            placeholder="Code"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCharacter() } }}
          />
          <button type="button" onClick={addCharacter}>+ Add</button>
        </div>
      </div>

      <div className="field-group">
        <label>Legend — Flags to display in the grid</label>
        <div className="arcade-flag-row">
          {RUN_FLAG_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={grid.trackedFlags.includes(o.value) ? 'pill active' : 'pill'}
              onClick={() => toggleFlag(o.value)}
              title={o.label}
            >{o.short}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
