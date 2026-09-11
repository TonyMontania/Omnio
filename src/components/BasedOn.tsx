// Cross-library adaptation link — picker + display.
//
// `basedOnItemId` on any item points to another item in the library
// (from ANY category), typically the original work an adaptation is
// based on:
//   Anime  → Manga / Book / VN
//   Movie  → Book / Comic
//   Series → Book / Comic / VN
//   Game   → Novel / Movie / VN
// The reverse edge ("adapted as") is rendered by scanning every
// item that has `basedOnItemId === me.id`.

import { useMemo, useState } from 'react'
import type { Item } from '../types'
import { assetSrc } from '../types'
import { CATEGORIES } from '../categories'

// ---- Picker (used inside editor panels) ----

interface PickerProps {
  currentItemId?: string
  value: string
  onChange: (id: string) => void
  allItems: Item[]
}

export function BasedOnPicker({ currentItemId, value, onChange, allItems }: PickerProps) {
  const [query, setQuery] = useState('')
  const linked = value ? allItems.find((i) => i.id === value) : null

  // Search across every category except the item's own if we know it
  // — an adaptation usually crosses categories, and self-linking is
  // handled by `originalWorkId` instead.
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: Item[] = []
    for (const it of allItems) {
      if (it.id === currentItemId) continue
      if (it.title.toLowerCase().includes(q)) out.push(it)
      if (out.length >= 20) break
    }
    return out
  }, [query, allItems, currentItemId])

  return (
    <div className="based-on-picker">
      {linked ? (
        <div className="based-on-linked">
          {linked.cover
            ? <img className="based-on-thumb" src={assetSrc(linked.cover)} alt="" />
            : <span className="based-on-thumb placeholder">{linked.title.charAt(0)}</span>}
          <div className="based-on-linked-text">
            <div className="based-on-linked-title">{linked.title}</div>
            <div className="based-on-linked-sub">{CATEGORIES.find((c) => c.id === linked.categoryId)?.label ?? linked.categoryId}</div>
          </div>
          <button type="button" className="ghost" onClick={() => { onChange(''); setQuery('') }}>Unlink</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search another library item to link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {hits.length > 0 && (
            <div className="based-on-hits">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="based-on-hit"
                  onClick={() => { onChange(h.id); setQuery('') }}
                >
                  {h.cover
                    ? <img className="based-on-thumb" src={assetSrc(h.cover)} alt="" />
                    : <span className="based-on-thumb placeholder">{h.title.charAt(0)}</span>}
                  <div className="based-on-hit-text">
                    <div className="based-on-hit-title">{h.title}</div>
                    <div className="based-on-hit-sub">{CATEGORIES.find((c) => c.id === h.categoryId)?.label ?? h.categoryId}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Display (used inside detail modals) ----

interface DisplayProps {
  itemId: string
  allItems: Item[]
  onNavigate: (id: string) => void
}

export function BasedOnDisplay({ itemId, allItems, onNavigate }: DisplayProps) {
  const me = allItems.find((i) => i.id === itemId)
  const basedOn = me?.basedOnItemId ? allItems.find((i) => i.id === me.basedOnItemId) : null
  const adaptations = allItems.filter((i) => i.basedOnItemId === itemId)
  if (!basedOn && adaptations.length === 0) return null

  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

  return (
    <div className="based-on-display">
      {basedOn && (
        <div className="based-on-row">
          <span className="based-on-label">Based on</span>
          <button type="button" className="based-on-chip" onClick={() => onNavigate(basedOn.id)}>
            {basedOn.cover
              ? <img className="based-on-chip-thumb" src={assetSrc(basedOn.cover)} alt="" />
              : <span className="based-on-chip-thumb placeholder">{basedOn.title.charAt(0)}</span>}
            <span className="based-on-chip-title">{basedOn.title}</span>
            <span className="based-on-chip-sub">{catLabel(basedOn.categoryId)}</span>
          </button>
        </div>
      )}
      {adaptations.length > 0 && (
        <div className="based-on-row">
          <span className="based-on-label">Adapted as</span>
          <div className="based-on-chip-list">
            {adaptations.map((a) => (
              <button key={a.id} type="button" className="based-on-chip" onClick={() => onNavigate(a.id)}>
                {a.cover
                  ? <img className="based-on-chip-thumb" src={assetSrc(a.cover)} alt="" />
                  : <span className="based-on-chip-thumb placeholder">{a.title.charAt(0)}</span>}
                <span className="based-on-chip-title">{a.title}</span>
                <span className="based-on-chip-sub">{catLabel(a.categoryId)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
