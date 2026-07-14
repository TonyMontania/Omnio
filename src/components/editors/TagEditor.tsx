// Free-form tags input. Enter (or the Add button) commits the current draft.

import { useState } from 'react'

export default function TagEditor({ tags, onAdd, onRemove, label = 'Tags', placeholder = 'Add tag' }: { tags: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; label?: string; placeholder?: string }) {
  const [input, setInput] = useState('')
  const handleAdd = () => { if (!input.trim()) return; onAdd(input.trim()); setInput('') }

  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="tag-list-input">
        <input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
        />
        <button type="button" onClick={handleAdd}>Add</button>
      </div>
      {tags.length > 0 && (
        <div className="tag-pill-list">
          {tags.map((t, i) => <span key={i} className="tag-pill">{t}<button type="button" onClick={() => onRemove(i)}>✕</button></span>)}
        </div>
      )}
    </div>
  )
}
