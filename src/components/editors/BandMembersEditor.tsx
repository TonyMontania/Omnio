// Editor for a band's line-up. Each member has a name, one or more roles
// (free-form with autocomplete from BAND_ROLE_SUGGESTIONS), and a "former"
// toggle to split current from past members.

import { useState } from 'react'
import type { BandMember } from '../../types'
import { BAND_ROLE_SUGGESTIONS } from '../../types'

export default function BandMembersEditor({ members, onChange }: {
  members: BandMember[]
  onChange: (next: BandMember[]) => void
}) {
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({})

  const addMember = () => onChange([...members, { id: crypto.randomUUID(), name: '', roles: [] }])
  const removeMember = (id: string) => onChange(members.filter((m) => m.id !== id))
  const patchMember = (id: string, patch: Partial<BandMember>) =>
    onChange(members.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const addRole = (id: string, role: string) => {
    const r = role.trim()
    if (!r) return
    const m = members.find((x) => x.id === id)
    if (m && !m.roles.includes(r)) patchMember(id, { roles: [...m.roles, r] })
    setRoleDraft((d) => ({ ...d, [id]: '' }))
  }
  const removeRole = (id: string, role: string) => {
    const m = members.find((x) => x.id === id)
    if (m) patchMember(id, { roles: m.roles.filter((r) => r !== role) })
  }

  return (
    <div className="band-members-editor">
      {members.map((m) => {
        const draft = roleDraft[m.id] ?? ''
        const suggestions = draft.trim()
          ? BAND_ROLE_SUGGESTIONS.filter((s) => !m.roles.includes(s) && s.toLowerCase().includes(draft.toLowerCase())).slice(0, 5)
          : []
        return (
          <div key={m.id} className="band-member-card">
            <div className="band-member-top">
              <input
                className="band-member-name"
                placeholder="Member name"
                value={m.name}
                onChange={(e) => patchMember(m.id, { name: e.target.value })}
              />
              <button
                type="button"
                className={m.former ? 'pill active' : 'pill'}
                onClick={() => patchMember(m.id, { former: !m.former })}
                title="Toggle former member"
              >{m.former ? 'Former' : 'Current'}</button>
              <button type="button" className="track-remove" onClick={() => removeMember(m.id)}>✕</button>
            </div>
            {m.roles.length > 0 && (
              <div className="tag-pill-list">
                {m.roles.map((r) => (
                  <span key={r} className="tag-pill">{r}<button type="button" onClick={() => removeRole(m.id, r)}>✕</button></span>
                ))}
              </div>
            )}
            <div className="tag-list-input">
              <input
                placeholder="Add role (Vocals, Guitar…)"
                value={draft}
                onChange={(e) => setRoleDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(m.id, draft) } }}
              />
              <button type="button" onClick={() => addRole(m.id, draft)}>Add</button>
            </div>
            {suggestions.length > 0 && (
              <div className="platform-suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="pill" onClick={() => addRole(m.id, s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <button type="button" className="upload-btn" onClick={addMember}>+ Add member</button>
    </div>
  )
}
