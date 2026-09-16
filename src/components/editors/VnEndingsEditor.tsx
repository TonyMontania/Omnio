// Sprint E — VN polish: routes / endings tracker.
//
// A vertical list of endings the user can tick off as they see them.
// Renders inside the VN item editor. Endings are grouped by their
// optional `route` field so a VN with per-heroine routes reads like
// a nested checklist; endings with no route sit under a "Common /
// standalone" heading. Each row has a checkbox, a name input, a
// small kind tag (good / bad / true / etc), and a note textarea.

import { useMemo } from 'react'
import type { VnEnding } from '../../types/entities'

interface Props {
  endings: VnEnding[]
  onChange: (next: VnEnding[]) => void
}

export default function VnEndingsEditor({ endings, onChange }: Props) {
  const grouped = useMemo(() => {
    // Group by `route`, preserving insertion order of routes as they
    // first appear so the user's arrangement stays intact.
    const map = new Map<string, VnEnding[]>()
    for (const e of endings) {
      const key = (e.route ?? '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries())
  }, [endings])

  const patch = (id: string, fn: (e: VnEnding) => VnEnding) => {
    onChange(endings.map((e) => (e.id === id ? fn(e) : e)))
  }
  const remove = (id: string) => onChange(endings.filter((e) => e.id !== id))
  const add = (route?: string) => {
    onChange([...endings, {
      id: crypto.randomUUID(),
      name: '',
      seen: false,
      route,
      createdAt: Date.now(),
    }])
  }

  const seenCount = endings.filter((e) => e.seen).length

  return (
    <div className="field-group vn-endings-editor">
      <div className="vn-endings-head">
        <label>Routes / endings</label>
        {endings.length > 0 && (
          <span className="vn-endings-count">{seenCount} / {endings.length} seen</span>
        )}
        <button type="button" className="secondary-btn" onClick={() => add(undefined)}>+ Add ending</button>
      </div>
      <p className="hint">Track the routes and endings you've unlocked. Optional Route field groups endings under the same heroine / path; leave it blank for standalone endings.</p>

      {endings.length === 0 && (
        <p className="hint" style={{ opacity: 0.6, marginTop: 8 }}>No endings tracked yet.</p>
      )}

      <div className="vn-endings-groups">
        {grouped.map(([route, list]) => (
          <div key={route || '__common__'} className="vn-endings-group">
            <div className="vn-endings-group-head">
              <h4>{route || 'Common / standalone'}</h4>
              <span className="vn-endings-group-count">
                {list.filter((e) => e.seen).length} / {list.length}
              </span>
              <button type="button" className="pill" onClick={() => add(route || undefined)}>+ ending here</button>
            </div>
            <ul className="vn-endings-list">
              {list.map((e) => (
                <li key={e.id} className={e.seen ? 'vn-ending seen' : 'vn-ending'}>
                  <label className="vn-ending-check">
                    <input
                      type="checkbox"
                      checked={e.seen}
                      onChange={(ev) => patch(e.id, (x) => ({ ...x, seen: ev.target.checked, seenAt: ev.target.checked && !x.seenAt ? new Date().toISOString().slice(0, 10) : x.seenAt }))}
                    />
                  </label>
                  <input
                    className="vn-ending-name"
                    placeholder="Ending name"
                    value={e.name}
                    onChange={(ev) => patch(e.id, (x) => ({ ...x, name: ev.target.value }))}
                  />
                  <input
                    className="vn-ending-route"
                    placeholder="Route (optional)"
                    value={e.route ?? ''}
                    onChange={(ev) => patch(e.id, (x) => ({ ...x, route: ev.target.value || undefined }))}
                  />
                  <input
                    className="vn-ending-kind"
                    placeholder="Kind (good / bad / true / normal)"
                    value={e.kind ?? ''}
                    onChange={(ev) => patch(e.id, (x) => ({ ...x, kind: ev.target.value || undefined }))}
                  />
                  <input
                    className="vn-ending-date"
                    type="date"
                    value={e.seenAt ?? ''}
                    onChange={(ev) => patch(e.id, (x) => ({ ...x, seenAt: ev.target.value || undefined }))}
                    title="Date you saw this ending"
                  />
                  <button
                    type="button"
                    className="vn-ending-remove"
                    onClick={() => remove(e.id)}
                    title="Remove ending"
                    aria-label="Remove ending"
                  >✕</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
