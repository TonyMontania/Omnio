// Sprint E — structured playthroughs / runs editor. Sits inside the
// Game item editor as its own section. Renders every playthrough as
// a collapsible card so a game with a lot of runs (a soulslike NG+
// grinder, a Roguelite) doesn't blow up the form vertically.
//
// The editor is purely a value shape — it never touches the parent
// item's playTime string. `sumHours` displayed in the header is
// informational: the parent stays authoritative for total-hours
// aggregation elsewhere in the app, and a user can leave individual
// playthroughs blank without polluting the total.

import { useState } from 'react'
import type { Playthrough } from '../../types/entities'
import { parseDurationToSeconds } from '../../types'

interface Props {
  playthroughs: Playthrough[]
  onChange: (next: Playthrough[]) => void
}

export default function PlaythroughsEditor({ playthroughs, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(playthroughs[0]?.id ?? null)

  const add = () => {
    const p: Playthrough = { id: crypto.randomUUID(), createdAt: Date.now() }
    onChange([...playthroughs, p])
    setOpenId(p.id)
  }
  const patch = (id: string, fn: (p: Playthrough) => Playthrough) => {
    onChange(playthroughs.map((p) => (p.id === id ? fn(p) : p)))
  }
  const remove = (id: string) => {
    onChange(playthroughs.filter((p) => p.id !== id))
    if (openId === id) setOpenId(null)
  }

  // Aggregate seconds across every playthrough with a parseable
  // hours value — display as a running total in the section header.
  const totalSeconds = playthroughs.reduce((sum, p) => {
    const s = p.hours ? parseDurationToSeconds(p.hours) : 0
    return sum + (s ?? 0)
  }, 0)
  const totalHours = totalSeconds / 3600
  const totalLabel = totalHours > 0
    ? `${playthroughs.length} run${playthroughs.length === 1 ? '' : 's'} · ${totalHours.toFixed(1)}h`
    : `${playthroughs.length} run${playthroughs.length === 1 ? '' : 's'}`

  return (
    <div className="field-group playthroughs-editor">
      <div className="playthroughs-head">
        <label>Playthroughs / runs</label>
        {playthroughs.length > 0 && <span className="playthroughs-total">{totalLabel}</span>}
        <button type="button" className="secondary-btn" onClick={add}>+ Add playthrough</button>
      </div>
      <p className="hint">Log discrete runs — a first campaign, a NG+ replay, a co-op with a friend. Different from the single "Play time" field above; use this when a game deserves more than one bullet.</p>

      {playthroughs.length === 0 && (
        <p className="hint" style={{ opacity: 0.6, marginTop: 8 }}>No playthroughs logged yet.</p>
      )}

      <ul className="playthroughs-list">
        {playthroughs.map((p, i) => {
          const isOpen = openId === p.id
          const summary = summarize(p, i)
          return (
            <li key={p.id} className={isOpen ? 'playthrough open' : 'playthrough'}>
              <div className="playthrough-summary" onClick={() => setOpenId(isOpen ? null : p.id)}>
                <span className="playthrough-chevron">{isOpen ? '▾' : '▸'}</span>
                <span className="playthrough-summary-label">{summary}</span>
                <button
                  type="button"
                  className="playthrough-remove"
                  onClick={(e) => { e.stopPropagation(); remove(p.id) }}
                  title="Remove playthrough"
                  aria-label="Remove playthrough"
                >✕</button>
              </div>
              {isOpen && (
                <div className="playthrough-body">
                  <div className="playthrough-row">
                    <label>Started</label>
                    <input type="date" value={p.startedAt ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, startedAt: e.target.value || undefined }))} />
                    <label>Finished</label>
                    <input type="date" value={p.finishedAt ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, finishedAt: e.target.value || undefined }))} />
                  </div>
                  <div className="playthrough-row">
                    <label>Hours</label>
                    <input placeholder="e.g. 24h, 12:30, 80" value={p.hours ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, hours: e.target.value || undefined }))} />
                    <label>Platform</label>
                    <input placeholder="PC, PS5, Switch…" value={p.platform ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, platform: e.target.value || undefined }))} />
                  </div>
                  <div className="playthrough-row">
                    <label>Character / class</label>
                    <input placeholder="Sorcerer, Ranger, Solo no-death…" value={p.character ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, character: e.target.value || undefined }))} />
                    <label>Difficulty</label>
                    <input placeholder="Very hard, NG+7, Ironman…" value={p.difficulty ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, difficulty: e.target.value || undefined }))} />
                  </div>
                  <div className="playthrough-row">
                    <label>Co-op / solo</label>
                    <input placeholder="Solo, with @friend, guild raid…" value={p.coop ?? ''} onChange={(e) => patch(p.id, (x) => ({ ...x, coop: e.target.value || undefined }))} />
                    <label>Milestones hit</label>
                    <input
                      placeholder="Comma-separated (true ending, no-death, all optionals)"
                      value={(p.achievementsHit ?? []).join(', ')}
                      onChange={(e) => patch(p.id, (x) => ({ ...x, achievementsHit: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                    />
                  </div>
                  <div className="playthrough-note">
                    <label>Note</label>
                    <textarea
                      rows={3}
                      placeholder="Mods used, house rules, memorable moments…"
                      value={p.note ?? ''}
                      onChange={(e) => patch(p.id, (x) => ({ ...x, note: e.target.value || undefined }))}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function summarize(p: Playthrough, i: number): string {
  const parts: string[] = []
  if (p.character) parts.push(p.character)
  if (p.difficulty) parts.push(p.difficulty)
  if (p.finishedAt) parts.push(p.finishedAt)
  else if (p.startedAt) parts.push(`started ${p.startedAt}`)
  if (p.hours) parts.push(p.hours)
  if (parts.length === 0) return `Run #${i + 1}`
  return parts.join(' · ')
}
