// Cross-library franchise view — every item sharing a franchise string,
// across every category, rendered as a flat by-year timeline, grouped
// sections, or a free canvas. Sections and graph state live under
// settings.franchiseSections / .franchiseGraphs and the view mode is
// controlled from outside so the detail strip stays in sync.

import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react'
import type { Item, FranchiseSection, FranchiseGraph } from '../types'
import { assetSrc } from '../types'
import { CATEGORIES } from '../categories'

// Code-split so users who never open graph mode don't pay for xyflow.
const FranchiseGraphView = lazy(() => import('./FranchiseGraphView'))

interface Props {
  franchise: string
  allItems: Item[]
  sections: FranchiseSection[]
  onSaveSections: (next: FranchiseSection[]) => void
  viewMode?: 'year' | 'sections' | 'graph'
  onSetViewMode: (mode: 'year' | 'sections' | 'graph') => void
  graph?: FranchiseGraph
  onSaveGraph: (next: FranchiseGraph | undefined) => void
  onClose: () => void
  onNavigate: (id: string) => void
}

function releaseYear(it: Item): number {
  if (it.releaseDate) {
    const m = /^(\d{4})/.exec(it.releaseDate)
    if (m) return Number(m[1])
  }
  if (it.releaseYear) {
    const n = Number(it.releaseYear)
    if (Number.isFinite(n)) return n
  }
  return Number.POSITIVE_INFINITY
}

type Mode = 'year' | 'sections' | 'graph'

export default function CrossLibraryFranchiseModal({ franchise, allItems, sections, onSaveSections, viewMode, onSetViewMode, graph, onSaveGraph, onClose, onNavigate }: Props) {
  const [graphFullscreen, setGraphFullscreen] = useState(false)
  const mode: Mode = viewMode ?? (sections.length > 0 ? 'sections' : 'year')
  const [organizeOpen, setOrganizeOpen] = useState(false)

  const items = useMemo(() => {
    const list = allItems.filter((i) => i.franchise === franchise)
    list.sort((a, b) => releaseYear(a) - releaseYear(b) || a.title.localeCompare(b.title))
    return list
  }, [allItems, franchise])

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.categoryId, (m.get(it.categoryId) ?? 0) + 1)
    return m
  }, [items])

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

  const assignedIds = useMemo(() => {
    const set = new Set<string>()
    for (const s of sections) for (const id of s.itemIds) set.add(id)
    return set
  }, [sections])

  const renderItem = (it: Item, note?: string) => {
    const y = releaseYear(it)
    return (
      <button
        key={it.id}
        type="button"
        className="franchise-cross-item"
        onClick={() => { onNavigate(it.id); onClose() }}
      >
        {it.cover
          ? <img className="franchise-cross-cover" src={assetSrc(it.cover)} alt={it.title} loading="lazy" />
          : <div className="franchise-cross-cover placeholder"><span>{it.title.charAt(0)}</span></div>}
        <div className="franchise-cross-body">
          <div className="franchise-cross-year">{Number.isFinite(y) ? y : '—'}</div>
          <div className="franchise-cross-title">{it.title}</div>
          <div className="franchise-cross-cat">{catLabel(it.categoryId)}</div>
          {note && <div className="franchise-cross-note">{note}</div>}
        </div>
      </button>
    )
  }

  const bigPanel = mode === 'graph' && graphFullscreen
  const panelStyle: CSSProperties = bigPanel
    ? { maxWidth: '100vw', width: '100vw', maxHeight: '100vh', height: '100vh', borderRadius: 0 }
    : { maxWidth: 900, width: '96vw', maxHeight: '92vh' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={bigPanel ? 'modal-panel franchise-cross-panel-fullscreen' : 'modal-panel'} onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>{franchise}</h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {items.length} item{items.length === 1 ? '' : 's'} across{' '}
              {Array.from(byCategory.entries()).map(([id, n]) => `${catLabel(id)} (${n})`).join(' · ')}
            </p>
          </div>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <p className="hint">No items share the "{franchise}" franchise yet — set it on a few and they'll all show up here.</p>
          ) : (
            <>
              <div className="franchise-mode-row">
                <div className="franchise-mode-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'year'}
                    className={mode === 'year' ? 'active' : ''}
                    onClick={() => onSetViewMode('year')}
                  >
                    By year
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'sections'}
                    className={mode === 'sections' ? 'active' : ''}
                    onClick={() => onSetViewMode('sections')}
                    disabled={sections.length === 0}
                    title={sections.length === 0 ? 'Create sections first with Organize…' : undefined}
                  >
                    By sections {sections.length > 0 && `(${sections.length})`}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'graph'}
                    className={mode === 'graph' ? 'active' : ''}
                    onClick={() => onSetViewMode('graph')}
                    title="Free-canvas diagram with covers, arrows and labels — good for Zelda-style timelines with branches and convergence"
                  >
                    By graph {(graph?.nodes.length ?? 0) > 0 && `(${graph!.nodes.length})`}
                  </button>
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setOrganizeOpen(true)}
                >
                  Organize sections…
                </button>
              </div>

              {mode === 'year' && (
                <div className="franchise-cross-timeline">
                  {items.map((it) => renderItem(it))}
                </div>
              )}

              {mode === 'sections' && (
                <div className="franchise-sections">
                  {sections.map((sec) => {
                    // Skip ids the franchise no longer contains (deleted item
                    // or renamed franchise field).
                    const secItems = sec.itemIds
                      .map((id) => itemById.get(id))
                      .filter((x): x is Item => !!x)
                    if (secItems.length === 0) return null
                    return (
                      <div key={sec.id} className="franchise-section">
                        <h3 className="franchise-section-title">{sec.name}</h3>
                        <div className="franchise-cross-timeline">
                          {secItems.map((it) => renderItem(it, sec.notes?.[it.id]))}
                        </div>
                      </div>
                    )
                  })}
                  {(() => {
                    const rest = items.filter((it) => !assignedIds.has(it.id))
                    if (rest.length === 0) return null
                    return (
                      <div className="franchise-section">
                        <h3 className="franchise-section-title franchise-section-title-muted">Ungrouped</h3>
                        <div className="franchise-cross-timeline">
                          {rest.map((it) => renderItem(it))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {mode === 'graph' && (
                <Suspense fallback={<p className="hint">Loading canvas…</p>}>
                  <FranchiseGraphView
                    franchise={franchise}
                    items={items}
                    graph={graph ?? { nodes: [], edges: [] }}
                    onSaveGraph={onSaveGraph}
                    onNavigate={(id) => { onNavigate(id); onClose() }}
                    fullscreen={graphFullscreen}
                    onSetFullscreen={setGraphFullscreen}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>
      </div>

      {organizeOpen && (
        <OrganizeSectionsModal
          franchise={franchise}
          items={items}
          sections={sections}
          onSave={(next) => { onSaveSections(next); setOrganizeOpen(false); if (next.length > 0) onSetViewMode('sections') }}
          onClose={() => setOrganizeOpen(false)}
        />
      )}
    </div>
  )
}

function OrganizeSectionsModal({ franchise, items, sections, onSave, onClose }: {
  franchise: string
  items: Item[]
  sections: FranchiseSection[]
  onSave: (next: FranchiseSection[]) => void
  onClose: () => void
}) {
  // Working copy, committed only when the user hits Save.
  const [draft, setDraft] = useState<FranchiseSection[]>(() => sections.map((s) => ({
    ...s,
    itemIds: [...s.itemIds],
    notes: s.notes ? { ...s.notes } : undefined,
  })))
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null)
  const [newSectionName, setNewSectionName] = useState('')
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null)

  const activeSection = draft.find((s) => s.id === activeId) ?? null

  const addSection = () => {
    const name = newSectionName.trim()
    if (!name) return
    const next: FranchiseSection = { id: crypto.randomUUID(), name, itemIds: [] }
    setDraft((d) => [...d, next])
    setActiveId(next.id)
    setNewSectionName('')
  }

  const renameSection = (id: string, name: string) => {
    setDraft((d) => d.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const deleteSection = (id: string) => {
    setDraft((d) => d.filter((s) => s.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const moveSection = (id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const idx = d.findIndex((s) => s.id === id)
      if (idx < 0) return d
      const j = idx + dir
      if (j < 0 || j >= d.length) return d
      const next = [...d]
      const [it] = next.splice(idx, 1)
      next.splice(j, 0, it)
      return next
    })
  }

  // An item lives in at most one section — moving it into a new one
  // implicitly removes it from wherever it was.
  const toggleItem = (itemId: string) => {
    if (!activeSection) return
    setDraft((d) => d.map((s) => {
      if (s.id === activeSection.id) {
        return s.itemIds.includes(itemId)
          ? { ...s, itemIds: s.itemIds.filter((x) => x !== itemId) }
          : { ...s, itemIds: [...s.itemIds, itemId] }
      }
      if (s.itemIds.includes(itemId)) {
        return { ...s, itemIds: s.itemIds.filter((x) => x !== itemId) }
      }
      return s
    }))
  }

  const moveItemInSection = (itemId: string, dir: -1 | 1) => {
    if (!activeSection) return
    setDraft((d) => d.map((s) => {
      if (s.id !== activeSection.id) return s
      const idx = s.itemIds.indexOf(itemId)
      if (idx < 0) return s
      const j = idx + dir
      if (j < 0 || j >= s.itemIds.length) return s
      const next = [...s.itemIds]
      const [x] = next.splice(idx, 1)
      next.splice(j, 0, x)
      return { ...s, itemIds: next }
    }))
  }

  const setNote = (itemId: string, note: string) => {
    if (!activeSection) return
    setDraft((d) => d.map((s) => {
      if (s.id !== activeSection.id) return s
      const notes = { ...(s.notes ?? {}) }
      if (note.trim()) notes[itemId] = note.trim()
      else delete notes[itemId]
      return { ...s, notes: Object.keys(notes).length > 0 ? notes : undefined }
    }))
  }

  const itemById = new Map(items.map((it) => [it.id, it] as const))
  const otherSectionOf = (itemId: string): FranchiseSection | undefined =>
    draft.find((s) => s.id !== activeSection?.id && s.itemIds.includes(itemId))

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-panel organize-sections-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>Organize sections</h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Arrange {franchise} as sections (Timeline A, Liberl Arc, Prime series…).
              Each item belongs to at most one section; unassigned items keep showing at
              the bottom of the by-sections view.
            </p>
          </div>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body organize-sections-body">
          {/* Left column — the section list. */}
          <div className="organize-sections-list">
            <div className="organize-add-row">
              <input
                type="text"
                placeholder="New section name…"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addSection() }}
              />
              <button type="button" className="secondary-btn" onClick={addSection} disabled={!newSectionName.trim()}>Add</button>
            </div>
            {draft.length === 0 && <p className="hint">No sections yet. Add one above.</p>}
            <ul>
              {draft.map((s, i) => (
                <li key={s.id} className={s.id === activeId ? 'active' : ''}>
                  <button type="button" className="organize-section-btn" onClick={() => setActiveId(s.id)}>
                    <span className="organize-section-name">{s.name}</span>
                    <span className="organize-section-count">{s.itemIds.length}</span>
                  </button>
                  <div className="organize-section-actions">
                    <button type="button" title="Move up" disabled={i === 0} onClick={() => moveSection(s.id, -1)}>↑</button>
                    <button type="button" title="Move down" disabled={i === draft.length - 1} onClick={() => moveSection(s.id, 1)}>↓</button>
                    <button type="button" title="Delete" className="danger" onClick={() => deleteSection(s.id)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — items in the active section + items to add. */}
          <div className="organize-items-panel">
            {activeSection ? (
              <>
                <input
                  type="text"
                  className="organize-section-rename"
                  value={activeSection.name}
                  onChange={(e) => renameSection(activeSection.id, e.target.value)}
                />
                <div className="organize-panel-label">In this section (drag to reorder with ↑ / ↓):</div>
                {activeSection.itemIds.length === 0 && <p className="hint">Empty. Pick items from the list below.</p>}
                <ul className="organize-in-section">
                  {activeSection.itemIds.map((id, i) => {
                    const it = itemById.get(id)
                    if (!it) return null
                    const note = activeSection.notes?.[id] ?? ''
                    const editing = editingNoteFor === id
                    return (
                      <li key={id}>
                        <div className="organize-item-row">
                          <button type="button" className="organize-item-move" disabled={i === 0} onClick={() => moveItemInSection(id, -1)}>↑</button>
                          <button type="button" className="organize-item-move" disabled={i === activeSection.itemIds.length - 1} onClick={() => moveItemInSection(id, 1)}>↓</button>
                          <span className="organize-item-title">{it.title}</span>
                          <span className="organize-item-year">{Number.isFinite(releaseYear(it)) ? releaseYear(it) : '—'}</span>
                          <button type="button" className="organize-item-note-toggle" onClick={() => setEditingNoteFor(editing ? null : id)}>
                            {note ? 'Note ✎' : '+ Note'}
                          </button>
                          <button type="button" className="organize-item-remove" onClick={() => toggleItem(id)} title="Remove from section">✕</button>
                        </div>
                        {editing && (
                          <input
                            type="text"
                            className="organize-item-note-input"
                            placeholder="Short note (e.g. Kiryu dies, Unreleased Kiwami 4)…"
                            value={note}
                            autoFocus
                            onChange={(e) => setNote(id, e.target.value)}
                            onBlur={() => setEditingNoteFor(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNoteFor(null) }}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div className="organize-panel-label">Available items in {franchise}:</div>
                <ul className="organize-available">
                  {items.filter((it) => !activeSection.itemIds.includes(it.id)).map((it) => {
                    const other = otherSectionOf(it.id)
                    return (
                      <li key={it.id}>
                        <button type="button" className="organize-available-item" onClick={() => toggleItem(it.id)}>
                          <span>{it.title}</span>
                          <span className="organize-available-meta">
                            {Number.isFinite(releaseYear(it)) ? releaseYear(it) : '—'}
                            {other && <em> · in "{other.name}"</em>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="hint">Add or pick a section on the left to arrange its items.</p>
            )}
          </div>
        </div>
        <div className="modal-actions" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="secondary-btn" onClick={() => onSave(draft.filter((s) => s.name.trim()))}>Save sections</button>
        </div>
      </div>
    </div>
  )
}
