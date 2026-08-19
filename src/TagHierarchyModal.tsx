// Tag hierarchy editor. Lists every tag currently in use across the
// library and lets the user pick a parent tag for each row (or leave it
// at "— top level"). The parent map lives in Settings.tagTree; the
// FiltersDropdown reads it to render a nested tree, and filterAndSort
// expands a parent selection to include every descendant.

import { useMemo, useState } from 'react'
import type { Item } from './types'

type Props = {
  items: Item[]
  tagTree: Record<string, string> | undefined
  onClose: () => void
  onSave: (next: Record<string, string>) => void
}

function collectTags(items: Item[]): string[] {
  const set = new Set<string>()
  for (const it of items) for (const t of it.tags ?? []) if (t) set.add(t)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

// Refuse to make X a child of Y if Y is already (transitively) a child
// of X — walking child→parent up to a bounded depth catches every cycle
// without needing a real graph library.
function wouldCycle(candidate: string, newParent: string, tree: Record<string, string>): boolean {
  if (candidate === newParent) return true
  let cur: string | undefined = newParent
  for (let hops = 0; hops < 128 && cur; hops++) {
    if (cur === candidate) return true
    cur = tree[cur]
  }
  return false
}

export default function TagHierarchyModal({ items, tagTree, onClose, onSave }: Props) {
  const allTags = useMemo(() => collectTags(items), [items])
  const [draft, setDraft] = useState<Record<string, string>>({ ...(tagTree ?? {}) })

  const setParent = (child: string, parent: string) => {
    setDraft((prev) => {
      const next = { ...prev }
      if (!parent) delete next[child]
      else if (!wouldCycle(child, parent, next)) next[child] = parent
      return next
    })
  }

  const parentOptions = (self: string) => allTags.filter((t) => t !== self)

  const rootCount = allTags.filter((t) => !draft[t]).length
  const childCount = allTags.length - rootCount

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel tag-hierarchy-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '92vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Tag hierarchy</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint">
            Pick a parent tag for any child so the Filters dropdown groups them
            visually and selecting the parent matches every descendant.
            {' '}{allTags.length} tags · {rootCount} top-level · {childCount} nested.
          </p>
          {allTags.length === 0 && <p className="hint">No tags yet — add some to items first.</p>}
          <div className="tag-hierarchy-list">
            {allTags.map((tag) => {
              const parent = draft[tag] ?? ''
              return (
                <div key={tag} className="tag-hierarchy-row">
                  <span className="tag-hierarchy-child">{tag}</span>
                  <span className="tag-hierarchy-arrow">→ parent</span>
                  <select value={parent} onChange={(e) => setParent(tag, e.target.value)}>
                    <option value="">— top level</option>
                    {parentOptions(tag).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-btn" onClick={() => { onSave(draft); onClose() }}>Save hierarchy</button>
        </div>
      </div>
    </div>
  )
}
