// Category-scoped franchise strip shown inside a detail modal. Same
// DOM for every category; the year formatter and item list vary per
// caller. Section grouping and graph preview mirror what the full
// cross-library modal renders so both stay in sync.

import { lazy, Suspense } from 'react'
import type { Item, FranchiseSection, FranchiseGraph } from '../../types'
import { assetSrc } from '../../types'

const FranchiseGraphPreview = lazy(() => import('./FranchiseGraphPreview'))

interface Props {
  items: Item[]
  currentId: string
  franchise?: string
  yearOf: (i: Item) => string
  onNavigate: (id: string) => void
  onOpenCrossLibrary?: (franchise: string) => void
  sections?: FranchiseSection[]
  viewMode?: 'year' | 'sections' | 'graph'
  graph?: FranchiseGraph
}

export default function DetailFranchiseTimeline({ items, currentId, franchise, yearOf, onNavigate, onOpenCrossLibrary, sections, viewMode, graph }: Props) {
  if (items.length <= 1) return null
  // Graph mode wins whenever active — even with no nodes yet — so the
  // strip acknowledges the setting rather than silently falling back.
  const showGraph = viewMode === 'graph'
  const graphHasContent = graph && graph.nodes.length > 0

  const renderItem = (f: Item, note?: string) => (
    <button
      key={f.id}
      type="button"
      className={f.id === currentId ? 'franchise-item current' : 'franchise-item'}
      onClick={() => f.id !== currentId && onNavigate(f.id)}
      title={note || undefined}
    >
      {f.cover && <img src={assetSrc(f.cover)} alt="" />}
      <span className="franchise-title">{f.title}</span>
      <span className="franchise-year">{yearOf(f)}</span>
      {note && <span className="franchise-note">{note}</span>}
    </button>
  )

  // Items referenced by a section that live in a different category are
  // dropped here (the strip is category-scoped). Sections that end up
  // empty after that filter don't render their header.
  const hasSections = !!sections && sections.length > 0 && viewMode !== 'year'
  const itemById = new Map(items.map((it) => [it.id, it] as const))
  const grouped = hasSections ? sections!
    .map((sec) => ({
      section: sec,
      list: sec.itemIds.map((id) => itemById.get(id)).filter((x): x is Item => !!x),
    }))
    .filter((g) => g.list.length > 0) : []
  const assigned = new Set(grouped.flatMap((g) => g.list.map((it) => it.id)))
  const ungrouped = hasSections ? items.filter((it) => !assigned.has(it.id)) : []

  return (
    <div className="field-group">
      <div className="franchise-strip-header">
        <label>Franchise{franchise ? ` — ${franchise}` : ''}</label>
        {franchise && onOpenCrossLibrary && (
          <button
            type="button"
            className="franchise-strip-open"
            onClick={() => onOpenCrossLibrary(franchise)}
            title="Open the full cross-library timeline (all categories, custom sections)"
          >
            See full franchise ↗
          </button>
        )}
      </div>
      {showGraph ? (
        graphHasContent ? (
          <Suspense fallback={<p className="hint">Loading diagram…</p>}>
            <FranchiseGraphPreview
              graph={graph!}
              items={items}
              currentId={currentId}
              onNavigate={onNavigate}
            />
          </Suspense>
        ) : (
          <p className="hint">This franchise is set to diagram view but no nodes are on the canvas yet. Open <b>See full franchise ↗</b> and drop some items in.</p>
        )
      ) : hasSections ? (
        <div className="franchise-sections-strip">
          {grouped.map(({ section, list }) => (
            <div key={section.id} className="franchise-section-strip">
              <div className="franchise-section-strip-title">{section.name}</div>
              <div className="franchise-timeline">
                {list.map((f) => renderItem(f, section.notes?.[f.id]))}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className="franchise-section-strip">
              <div className="franchise-section-strip-title franchise-section-strip-title-muted">Ungrouped</div>
              <div className="franchise-timeline">
                {ungrouped.map((f) => renderItem(f))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="franchise-timeline">
          {items.map((f) => renderItem(f))}
        </div>
      )}
    </div>
  )
}
