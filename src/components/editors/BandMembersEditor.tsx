// Editor for a band's line-up. Each member has a name, one or more roles
// (free-form with autocomplete from BAND_ROLE_SUGGESTIONS), a "former"
// toggle to split current from past members, an optional † deceased mark,
// and optional extra stints for members who switched instruments over
// time (bassist → rhythm guitarist, drummer → vocalist, …). The top-level
// roles + joinedIn/leftIn always represent the primary tenure; stints[]
// only shows when explicitly added.

import { useState } from 'react'
import type { BandMember, MemberStint } from '../../types'
import { BAND_ROLE_SUGGESTIONS } from '../../types'

export default function BandMembersEditor({ members, onChange }: {
  members: BandMember[]
  onChange: (next: BandMember[]) => void
}) {
  // Per-input role drafts keyed by "memberId" or "memberId::stintId".
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

  // --- Stint helpers ---
  const addStint = (memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    if (!m) return
    const next: MemberStint = { id: crypto.randomUUID(), roles: [] }
    patchMember(memberId, { stints: [...(m.stints ?? []), next] })
  }
  const patchStint = (memberId: string, stintId: string, patch: Partial<MemberStint>) => {
    const m = members.find((x) => x.id === memberId)
    if (!m || !m.stints) return
    patchMember(memberId, { stints: m.stints.map((s) => (s.id === stintId ? { ...s, ...patch } : s)) })
  }
  const removeStint = (memberId: string, stintId: string) => {
    const m = members.find((x) => x.id === memberId)
    if (!m || !m.stints) return
    const next = m.stints.filter((s) => s.id !== stintId)
    patchMember(memberId, { stints: next.length > 0 ? next : undefined })
  }
  const addStintRole = (memberId: string, stintId: string, role: string) => {
    const r = role.trim()
    if (!r) return
    const m = members.find((x) => x.id === memberId)
    const s = m?.stints?.find((x) => x.id === stintId)
    if (m && s && !s.roles.includes(r)) patchStint(memberId, stintId, { roles: [...s.roles, r] })
    setRoleDraft((d) => ({ ...d, [`${memberId}::${stintId}`]: '' }))
  }
  const removeStintRole = (memberId: string, stintId: string, role: string) => {
    const m = members.find((x) => x.id === memberId)
    const s = m?.stints?.find((x) => x.id === stintId)
    if (m && s) patchStint(memberId, stintId, { roles: s.roles.filter((r) => r !== role) })
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
              <button
                type="button"
                className={m.deceased ? 'pill active band-member-deceased' : 'pill band-member-deceased'}
                onClick={() => patchMember(m.id, { deceased: !m.deceased })}
                title={m.deceased ? 'Marked as deceased — click to undo' : 'Mark as deceased'}
              >†</button>
              <button type="button" className="track-remove" onClick={() => removeMember(m.id)}>✕</button>
            </div>
            <div className="band-member-period">
              <input
                className="band-member-year"
                placeholder="Joined (e.g. 1998)"
                value={m.joinedIn ?? ''}
                onChange={(e) => patchMember(m.id, { joinedIn: e.target.value })}
              />
              {m.former && (
                <input
                  className="band-member-year"
                  placeholder="Left (e.g. 2004)"
                  value={m.leftIn ?? ''}
                  onChange={(e) => patchMember(m.id, { leftIn: e.target.value })}
                />
              )}
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

            {/* Extra stints — role changes over time. Only rendered when
                the user has added at least one, keeping the common
                one-role case free of noise. */}
            {(m.stints ?? []).map((s) => {
              const stintKey = `${m.id}::${s.id}`
              const sDraft = roleDraft[stintKey] ?? ''
              const sSuggestions = sDraft.trim()
                ? BAND_ROLE_SUGGESTIONS.filter((x) => !s.roles.includes(x) && x.toLowerCase().includes(sDraft.toLowerCase())).slice(0, 5)
                : []
              return (
                <div key={s.id} className="band-stint">
                  <div className="band-stint-head">
                    <span className="band-stint-label">Also</span>
                    <input
                      className="band-member-year"
                      placeholder="From"
                      value={s.from ?? ''}
                      onChange={(e) => patchStint(m.id, s.id, { from: e.target.value })}
                    />
                    <input
                      className="band-member-year"
                      placeholder="To"
                      value={s.to ?? ''}
                      onChange={(e) => patchStint(m.id, s.id, { to: e.target.value })}
                    />
                    <button type="button" className="track-remove" onClick={() => removeStint(m.id, s.id)}>✕</button>
                  </div>
                  {s.roles.length > 0 && (
                    <div className="tag-pill-list">
                      {s.roles.map((r) => (
                        <span key={r} className="tag-pill">{r}<button type="button" onClick={() => removeStintRole(m.id, s.id, r)}>✕</button></span>
                      ))}
                    </div>
                  )}
                  <div className="tag-list-input">
                    <input
                      placeholder="Add role for this stint"
                      value={sDraft}
                      onChange={(e) => setRoleDraft((d) => ({ ...d, [stintKey]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStintRole(m.id, s.id, sDraft) } }}
                    />
                    <button type="button" onClick={() => addStintRole(m.id, s.id, sDraft)}>Add</button>
                  </div>
                  {sSuggestions.length > 0 && (
                    <div className="platform-suggestions">
                      {sSuggestions.map((x) => (
                        <button key={x} type="button" className="pill" onClick={() => addStintRole(m.id, s.id, x)}>{x}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <button type="button" className="upload-btn band-stint-add" onClick={() => addStint(m.id)}>+ Add stint (different role period)</button>
          </div>
        )
      })}
      <button type="button" className="upload-btn" onClick={addMember}>+ Add member</button>
    </div>
  )
}
