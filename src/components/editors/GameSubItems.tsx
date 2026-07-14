// Yes/no toggle plus editable list of sub-entries (DLC or Addons for a game).
// Each entry can have its own status. Used twice inside a Game detail form.

import { useState } from 'react'
import type { DlcEntry, GameStatus } from '../../types'
import { GAME_STATUS_OPTIONS } from '../../types'

export default function GameSubItems({
  question, enabled, onToggle, entries, onAdd, onRemove, onStatusChange, placeholder, showStatus = true,
}: {
  question: string; enabled: boolean; onToggle: (v: boolean) => void
  entries: DlcEntry[]; onAdd: (name: string) => void; onRemove: (id: string) => void
  onStatusChange: (id: string, status: GameStatus) => void; placeholder: string; showStatus?: boolean
}) {
  const [input, setInput] = useState('')
  const handleAdd = () => { if (!input.trim()) return; onAdd(input.trim()); setInput('') }

  return (
    <div className="field-group">
      <label>{question}</label>
      <div className="yesno">
        <button type="button" className={enabled ? 'pill active' : 'pill'} onClick={() => onToggle(true)}>Yes</button>
        <button type="button" className={!enabled ? 'pill active' : 'pill'} onClick={() => onToggle(false)}>No</button>
      </div>
      {enabled && (
        <div className="tag-list-field">
          <div className="tag-list-input">
            <input
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            />
            <button type="button" onClick={handleAdd}>Add</button>
          </div>
          {entries.length > 0 && (
            <ul className="tag-list">
              {entries.map((entry) => (
                <li key={entry.id} className="dlc-row">
                  <span>{entry.name}</span>
                  {showStatus && (
                    <select value={entry.status} onChange={(e) => onStatusChange(entry.id, e.target.value as GameStatus)}>
                      {GAME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => onRemove(entry.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
