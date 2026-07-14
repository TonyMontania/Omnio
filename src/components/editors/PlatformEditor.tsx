// Free-form platform picker with autocomplete from built-in suggestions
// plus whatever platforms already exist across the user's library.

import { useState } from 'react'
import type { Platform } from '../../types'
import { PLATFORM_SUGGESTIONS } from '../../types'

export default function PlatformEditor({ value, onChange, existing }: { value: Platform[]; onChange: (v: Platform[]) => void; existing: Platform[] }) {
  const [input, setInput] = useState('')
  const known = Array.from(new Set([...PLATFORM_SUGGESTIONS, ...existing])).sort()
  const add = (p: string) => { const t = p.trim(); if (!t || value.includes(t)) return; onChange([...value, t]); setInput('') }
  const remove = (p: string) => onChange(value.filter((x) => x !== p))
  const suggestions = known.filter((k) => !value.includes(k) && k.toLowerCase().includes(input.toLowerCase())).slice(0, 6)
  return (
    <div className="platform-editor">
      <div className="tag-list-input">
        <input
          placeholder="Add platform (or pick a suggestion)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
        />
        <button type="button" onClick={() => add(input)}>Add</button>
      </div>
      {input.trim() && suggestions.length > 0 && (
        <div className="platform-suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="pill" onClick={() => add(s)}>{s}</button>
          ))}
        </div>
      )}
      {!input.trim() && value.length === 0 && (
        <div className="platform-suggestions">
          {PLATFORM_SUGGESTIONS.slice(0, 6).map((s) => (
            <button key={s} type="button" className="pill" onClick={() => add(s)}>{s}</button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="tag-pill-list">
          {value.map((p) => <span key={p} className="tag-pill">{p}<button type="button" onClick={() => remove(p)}>✕</button></span>)}
        </div>
      )}
    </div>
  )
}
